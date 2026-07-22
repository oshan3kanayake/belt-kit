import PDFDocument = require("pdfkit");

import {
  getFirestore,
  type DocumentData,
} from "firebase-admin/firestore";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  logger,
} from "firebase-functions";

import {
  onRequest,
} from "firebase-functions/v2/https";

const FUNCTIONS_REGION = "us-central1";

const ALLOWED_REPORT_ROLES = new Set([
  "owner",
  "manager",
  "advisor",
  "admin",
]);

type ReportType =
  | "person"
  | "month";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  note: string;
}

interface EmployeeInfo {
  id: string;
  displayName: string;
}

interface MonthlyEmployeeSummary {
  employeeId: string;
  displayName: string;
  present: number;
  onLeave: number;
  other: number;
  total: number;
}

/**
 * Downloads an attendance report as a PDF.
 *
 * Person report:
 * GET ?reportType=person&month=2026-07&employeeId=EMPLOYEE_UID
 *
 * Monthly report:
 * GET ?reportType=month&month=2026-07
 */
export const downloadAttendanceReport = onRequest(
  {
    region: FUNCTIONS_REGION,

    /**
     * Allows local frontend development.
     *
     * Replace true with your production frontend origin later,
     * for example:
     *
     * cors: [
     *   "https://your-domain.example",
     *   "http://localhost:5173",
     * ],
     */
    cors: true,

    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request, response) => {
    try {
      if (request.method !== "GET") {
        response.setHeader(
          "Allow",
          "GET",
        );

        response.status(405).json({
          error: {
            message:
              "Only GET requests are supported.",
            status:
              "METHOD_NOT_ALLOWED",
          },
        });

        return;
      }

      const header = request.headers.authorization;
      logger.info("PDF AUTH HEADER", {
        exists: !!header,
        startsWithBearer: header?.startsWith("Bearer "),
        length: header?.length,
      });

      const requesterUid =
        await authenticateRequest(request);

      const db = getFirestore();

      const requesterReference = db
        .collection("users")
        .doc(requesterUid);

      const requesterSnapshot =
        await requesterReference.get();

      if (!requesterSnapshot.exists) {
        throw new HttpError(
          403,
          "User profile not found.",
          "PERMISSION_DENIED",
        );
      }

      const requesterData =
        requesterSnapshot.data();

      if (!requesterData) {
        throw new HttpError(
          403,
          "User profile is invalid.",
          "PERMISSION_DENIED",
        );
      }

      if (
        requesterData.active === false ||
        requesterData.isActive === false ||
        requesterData.disabled === true
      ) {
        throw new HttpError(
          403,
          "This user account is inactive.",
          "PERMISSION_DENIED",
        );
      }

      const requesterRole =
        readRequiredString(
          requesterData.role,
          "User role",
        ).toLowerCase();

      if (
        !ALLOWED_REPORT_ROLES.has(
          requesterRole,
        )
      ) {
        throw new HttpError(
          403,
          "You do not have permission to download attendance reports.",
          "PERMISSION_DENIED",
        );
      }

      const branchId =
        readRequiredString(
          requesterData.branchId,
          "User branch",
        );

      const reportType =
        parseReportType(
          request.query.reportType,
        );

      const month =
        parseMonth(
          request.query.month,
        );

      let employeeId: string | null =
        null;

      if (reportType === "person") {
        employeeId =
          readQueryString(
            request.query.employeeId,
          );

        if (!employeeId) {
          throw new HttpError(
            400,
            "employeeId is required for a person report.",
            "INVALID_ARGUMENT",
          );
        }
      }

      const {
        startDate,
        endDate,
      } = getMonthDateRange(month);

      /**
       * Because attendance dates use YYYY-MM-DD, string range
       * queries work correctly within one consistent date format.
       */
      const attendanceSnapshot =
        await db
          .collection("attendance")
          .where(
            "branchId",
            "==",
            branchId,
          )
          .where(
            "date",
            ">=",
            startDate,
          )
          .where(
            "date",
            "<=",
            endDate,
          )
          .orderBy(
            "date",
            "asc",
          )
          .get();

      let attendanceRecords =
        attendanceSnapshot.docs
          .map((document) =>
            parseAttendanceRecord(
              document.id,
              document.data(),
            ),
          )
          .filter(
            (
              record,
            ): record is AttendanceRecord =>
              record !== null,
          );

      if (
        reportType === "person" &&
        employeeId
      ) {
        attendanceRecords =
          attendanceRecords.filter(
            (record) =>
              record.employeeId ===
              employeeId,
          );
      }

      const employeeIds =
        new Set<string>(
          attendanceRecords.map(
            (record) =>
              record.employeeId,
          ),
        );

      if (employeeId) {
        employeeIds.add(employeeId);
      }

      const employeeMap =
        await loadEmployeeInformation(
          [...employeeIds],
          branchId,
        );

      let selectedEmployee:
        | EmployeeInfo
        | null = null;

      if (
        reportType === "person" &&
        employeeId
      ) {
        selectedEmployee =
          employeeMap.get(employeeId) ??
          null;

        if (!selectedEmployee) {
          throw new HttpError(
            404,
            "Employee was not found in your branch.",
            "NOT_FOUND",
          );
        }
      }

      const branchSnapshot =
        await db
          .collection("branches")
          .doc(branchId)
          .get();

      const branchName =
        readOptionalString(
          branchSnapshot.data()?.name,
        ) ??
        branchId;

      const generatedBy =
        readOptionalString(
          requesterData.displayName,
        ) ??
        readOptionalString(
          requesterData.name,
        ) ??
        readOptionalString(
          requesterData.email,
        ) ??
        requesterUid;

      const filename =
        buildReportFilename({
          reportType,
          month,
          selectedEmployee,
        });

      response.status(200);

      response.setHeader(
        "Content-Type",
        "application/pdf",
      );

      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      response.setHeader(
        "Cache-Control",
        "private, no-store",
      );

      await streamAttendancePdf({
        response,
        reportType,
        month,
        branchName,
        generatedBy,
        attendanceRecords,
        employeeMap,
        selectedEmployee,
      });
    } catch (error: unknown) {
      logger.error(
        "Attendance report generation failed.",
        error,
      );

      if (response.headersSent) {
        response.end();
        return;
      }

      if (error instanceof HttpError) {
        response
          .status(error.statusCode)
          .json({
            error: {
              message: error.message,
              status: error.status,
            },
          });

        return;
      }

      response.status(500).json({
        error: {
          message:
            "Unable to generate attendance report.",
          status: "INTERNAL",
        },
      });
    }
  },
);

async function authenticateRequest(
  request: {
    get:
      (
        headerName: string,
      ) => string | undefined;
  },
): Promise<string> {
  const authorizationHeader =
    request.get("Authorization");

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith(
      "Bearer ",
    )
  ) {
    throw new HttpError(
      401,
      "A Firebase ID token is required.",
      "UNAUTHENTICATED",
    );
  }

  const idToken =
    authorizationHeader
      .slice("Bearer ".length)
      .trim();

  if (!idToken) {
    throw new HttpError(
      401,
      "A Firebase ID token is required.",
      "UNAUTHENTICATED",
    );
  }

  try {
    const decodedToken =
      await getAuth()
        .verifyIdToken(idToken);

    return decodedToken.uid;
  } catch (error) {
    logger.warn("PDF ID token verification failed", {
      code: typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined,
      message: error instanceof Error ? error.message : "Unknown verification error",
      authEmulatorConfigured: !!process.env.FIREBASE_AUTH_EMULATOR_HOST,
      projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
    });
    throw new HttpError(
      401,
      "The Firebase ID token is invalid or expired.",
      "UNAUTHENTICATED",
    );
  }
}

function parseReportType(
  value: unknown,
): ReportType {
  const reportType =
    readQueryString(value);

  if (
    reportType === "person" ||
    reportType === "month"
  ) {
    return reportType;
  }

  throw new HttpError(
    400,
    "reportType must be person or month.",
    "INVALID_ARGUMENT",
  );
}

function parseMonth(
  value: unknown,
): string {
  const month =
    readQueryString(value);

  if (
    !month ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(
      month,
    )
  ) {
    throw new HttpError(
      400,
      "month must use YYYY-MM format.",
      "INVALID_ARGUMENT",
    );
  }

  return month;
}

function getMonthDateRange(
  month: string,
): {
  startDate: string;
  endDate: string;
} {
  const [
    yearValue,
    monthValue,
  ] = month.split("-");

  const year = Number(yearValue);
  const numericMonth =
    Number(monthValue);

  const finalDay =
    new Date(
      Date.UTC(
        year,
        numericMonth,
        0,
      ),
    ).getUTCDate();

  return {
    startDate: `${month}-01`,

    endDate:
      `${month}-` +
      String(finalDay).padStart(
        2,
        "0",
      ),
  };
}

function parseAttendanceRecord(
  id: string,
  data: DocumentData,
): AttendanceRecord | null {
  const employeeId =
    readOptionalString(
      data.employeeId,
    );

  const date =
    readOptionalString(
      data.date,
    );

  const status =
    readOptionalString(
      data.status,
    );

  if (
    !employeeId ||
    !date ||
    !status
  ) {
    return null;
  }

  return {
    id,
    employeeId,
    date,
    status,
    note:
      readOptionalString(
        data.note,
      ) ?? "",
  };
}

async function loadEmployeeInformation(
  employeeIds: string[],
  branchId: string,
): Promise<Map<string, EmployeeInfo>> {
  const db = getFirestore();

  const employeeMap =
    new Map<string, EmployeeInfo>();

  if (employeeIds.length === 0) {
    return employeeMap;
  }

  const references =
    employeeIds.map(
      (employeeId) =>
        db
          .collection("users")
          .doc(employeeId),
    );

  const snapshots =
    await db.getAll(
      ...references,
    );

  for (const snapshot of snapshots) {
    if (!snapshot.exists) {
      continue;
    }

    const employeeData =
      snapshot.data();

    if (!employeeData) {
      continue;
    }

    if (
      employeeData.branchId !==
      branchId
    ) {
      continue;
    }

    const displayName =
      readOptionalString(
        employeeData.displayName,
      ) ??
      readOptionalString(
        employeeData.name,
      ) ??
      readOptionalString(
        employeeData.fullName,
      ) ??
      readOptionalString(
        employeeData.email,
      ) ??
      snapshot.id;

    employeeMap.set(
      snapshot.id,
      {
        id: snapshot.id,
        displayName,
      },
    );
  }

  /**
   * Attendance may contain an employee whose profile has since
   * been archived or removed. Keep that attendance visible in
   * the monthly report using the UID as a fallback label.
   */
  for (const employeeId of employeeIds) {
    if (!employeeMap.has(employeeId)) {
      employeeMap.set(
        employeeId,
        {
          id: employeeId,
          displayName:
            `Employee ${employeeId}`,
        },
      );
    }
  }

  return employeeMap;
}

async function streamAttendancePdf(
  input: {
    response: NodeJS.WritableStream;

    reportType: ReportType;
    month: string;

    branchName: string;
    generatedBy: string;

    attendanceRecords:
      AttendanceRecord[];

    employeeMap:
      Map<string, EmployeeInfo>;

    selectedEmployee:
      EmployeeInfo | null;
  },
): Promise<void> {
  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      const doc =
        new PDFDocument({
          size: "A4",

          margin: 40,

          bufferPages: true,

          info: {
            Title:
              input.reportType ===
              "person"
                ? "Employee Attendance Report"
                : "Monthly Attendance Report",

            Author: "Belt-Kit",

            Subject:
              "Attendance report",
          },
        });

      doc.on(
        "error",
        reject,
      );

      input.response.on(
        "finish",
        resolve,
      );

      doc.pipe(
        input.response,
      );

      drawReportHeader(
        doc,
        input,
      );

      if (
        input.reportType ===
        "person"
      ) {
        drawPersonReport(
          doc,
          input,
        );
      } else {
        drawMonthlyReport(
          doc,
          input,
        );
      }

      addPageNumbers(doc);

      doc.end();
    },
  );
}

function drawReportHeader(
  doc: PDFKit.PDFDocument,
  input: {
    reportType: ReportType;
    month: string;
    branchName: string;
    generatedBy: string;
    selectedEmployee:
      EmployeeInfo | null;
  },
): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(
      "BELT-KIT",
      {
        align: "center",
      },
    );

  doc
    .moveDown(0.3)
    .fontSize(15)
    .text(
      input.reportType ===
      "person"
        ? "Employee Attendance Report"
        : "Monthly Attendance Report",
      {
        align: "center",
      },
    );

  doc.moveDown(1);

  drawLabelValue(
    doc,
    "Branch",
    input.branchName,
  );

  drawLabelValue(
    doc,
    "Month",
    formatMonthLabel(
      input.month,
    ),
  );

  if (
    input.selectedEmployee
  ) {
    drawLabelValue(
      doc,
      "Employee",
      input
        .selectedEmployee
        .displayName,
    );
  }

  drawLabelValue(
    doc,
    "Generated by",
    input.generatedBy,
  );

  drawLabelValue(
    doc,
    "Generated at",
    new Intl.DateTimeFormat(
      "en-GB",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone:
          "Asia/Colombo",
      },
    ).format(new Date()),
  );

  doc.moveDown(1);
}

function drawPersonReport(
  doc: PDFKit.PDFDocument,
  input: {
    attendanceRecords:
      AttendanceRecord[];

    selectedEmployee:
      EmployeeInfo | null;
  },
): void {
  const summary =
    calculateAttendanceSummary(
      input.attendanceRecords,
    );

  drawSummaryMetrics(
    doc,
    [
      {
        label: "Marked days",
        value: summary.total,
      },
      {
        label: "Present",
        value: summary.present,
      },
      {
        label: "On leave",
        value: summary.onLeave,
      },
      {
        label: "Other",
        value: summary.other,
      },
    ],
  );

  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(
      "Daily attendance",
    );

  doc.moveDown(0.5);

  if (
    input.attendanceRecords.length ===
    0
  ) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        "No attendance records were found for this employee and month.",
      );

    return;
  }

  drawTable(
    doc,
    input.attendanceRecords,
    [
      {
        header: "Date",
        width: 100,
        value: (row) =>
          formatAttendanceDate(
            row.date,
          ),
      },
      {
        header: "Status",
        width: 110,
        value: (row) =>
          formatStatus(
            row.status,
          ),
      },
      {
        header: "Note",
        width: 305,
        value: (row) =>
          row.note || "-",
      },
    ],
  );
}

function drawMonthlyReport(
  doc: PDFKit.PDFDocument,
  input: {
    attendanceRecords:
      AttendanceRecord[];

    employeeMap:
      Map<string, EmployeeInfo>;
  },
): void {
  const monthlySummary =
    createMonthlyEmployeeSummary(
      input.attendanceRecords,
      input.employeeMap,
    );

  const overallSummary =
    calculateAttendanceSummary(
      input.attendanceRecords,
    );

  drawSummaryMetrics(
    doc,
    [
      {
        label: "Employees",
        value:
          monthlySummary.length,
      },
      {
        label: "Marked entries",
        value:
          overallSummary.total,
      },
      {
        label: "Present entries",
        value:
          overallSummary.present,
      },
      {
        label: "Leave entries",
        value:
          overallSummary.onLeave,
      },
    ],
  );

  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(
      "Employee summary",
    );

  doc.moveDown(0.5);

  if (
    monthlySummary.length === 0
  ) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        "No attendance records were found for this month.",
      );

    return;
  }

  drawTable(
    doc,
    monthlySummary,
    [
      {
        header: "Employee",
        width: 235,
        value: (row) =>
          row.displayName,
      },
      {
        header: "Present",
        width: 75,
        value: (row) =>
          String(row.present),
        align: "center",
      },
      {
        header: "Leave",
        width: 70,
        value: (row) =>
          String(row.onLeave),
        align: "center",
      },
      {
        header: "Other",
        width: 65,
        value: (row) =>
          String(row.other),
        align: "center",
      },
      {
        header: "Total",
        width: 70,
        value: (row) =>
          String(row.total),
        align: "center",
      },
    ],
  );

  doc.moveDown(1.2);

  ensureVerticalSpace(
    doc,
    80,
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(
      "Detailed attendance",
    );

  doc.moveDown(0.5);

  const detailedRows =
    [...input.attendanceRecords]
      .sort(
        (
          first,
          second,
        ) => {
          const dateComparison =
            first.date.localeCompare(
              second.date,
            );

          if (
            dateComparison !== 0
          ) {
            return dateComparison;
          }

          const firstName =
            input.employeeMap.get(
              first.employeeId,
            )?.displayName ??
            first.employeeId;

          const secondName =
            input.employeeMap.get(
              second.employeeId,
            )?.displayName ??
            second.employeeId;

          return firstName.localeCompare(
            secondName,
          );
        },
      );

  drawTable(
    doc,
    detailedRows,
    [
      {
        header: "Date",
        width: 85,
        value: (row) =>
          formatAttendanceDate(
            row.date,
          ),
      },
      {
        header: "Employee",
        width: 190,
        value: (row) =>
          input.employeeMap.get(
            row.employeeId,
          )?.displayName ??
          row.employeeId,
      },
      {
        header: "Status",
        width: 95,
        value: (row) =>
          formatStatus(
            row.status,
          ),
      },
      {
        header: "Note",
        width: 145,
        value: (row) =>
          row.note || "-",
      },
    ],
  );
}

function calculateAttendanceSummary(
  records: AttendanceRecord[],
): {
  present: number;
  onLeave: number;
  other: number;
  total: number;
} {
  let present = 0;
  let onLeave = 0;
  let other = 0;

  for (const record of records) {
    const normalizedStatus =
      normalizeStatus(
        record.status,
      );

    if (
      normalizedStatus ===
      "PRESENT"
    ) {
      present += 1;
    } else if (
      normalizedStatus ===
      "ON_LEAVE"
    ) {
      onLeave += 1;
    } else {
      other += 1;
    }
  }

  return {
    present,
    onLeave,
    other,
    total: records.length,
  };
}

function createMonthlyEmployeeSummary(
  records: AttendanceRecord[],
  employeeMap:
    Map<string, EmployeeInfo>,
): MonthlyEmployeeSummary[] {
  const summaryMap =
    new Map<
      string,
      MonthlyEmployeeSummary
    >();

  for (const record of records) {
    const existing =
      summaryMap.get(
        record.employeeId,
      ) ?? {
        employeeId:
          record.employeeId,

        displayName:
          employeeMap.get(
            record.employeeId,
          )?.displayName ??
          record.employeeId,

        present: 0,
        onLeave: 0,
        other: 0,
        total: 0,
      };

    const normalizedStatus =
      normalizeStatus(
        record.status,
      );

    if (
      normalizedStatus ===
      "PRESENT"
    ) {
      existing.present += 1;
    } else if (
      normalizedStatus ===
      "ON_LEAVE"
    ) {
      existing.onLeave += 1;
    } else {
      existing.other += 1;
    }

    existing.total += 1;

    summaryMap.set(
      record.employeeId,
      existing,
    );
  }

  return [...summaryMap.values()]
    .sort(
      (
        first,
        second,
      ) =>
        first.displayName.localeCompare(
          second.displayName,
        ),
    );
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  const startX =
    doc.page.margins.left;

  const startY =
    doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      `${label}:`,
      startX,
      startY,
      {
        width: 90,
        continued: false,
      },
    );

  doc
    .font("Helvetica")
    .fontSize(9)
    .text(
      value,
      startX + 95,
      startY,
      {
        width:
          doc.page.width -
          startX -
          135,
      },
    );

  doc.y =
    Math.max(
      doc.y,
      startY + 15,
    );
}

function drawSummaryMetrics(
  doc: PDFKit.PDFDocument,
  metrics: Array<{
    label: string;
    value: number;
  }>,
): void {
  const pageWidth =
    doc.page.width -
    doc.page.margins.left -
    doc.page.margins.right;

  const gap = 8;

  const boxWidth =
    (
      pageWidth -
      gap *
        (
          metrics.length -
          1
        )
    ) /
    metrics.length;

  const boxHeight = 52;

  const startX =
    doc.page.margins.left;

  const startY =
    doc.y;

  metrics.forEach(
    (
      metric,
      index,
    ) => {
      const x =
        startX +
        index *
          (
            boxWidth +
            gap
          );

      doc
        .lineWidth(0.5)
        .rect(
          x,
          startY,
          boxWidth,
          boxHeight,
        )
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(
          String(metric.value),
          x,
          startY + 9,
          {
            width: boxWidth,
            align: "center",
          },
        );

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(
          metric.label,
          x + 4,
          startY + 32,
          {
            width:
              boxWidth - 8,
            align: "center",
          },
        );
    },
  );

  doc.y =
    startY +
    boxHeight +
    4;
}

interface TableColumn<RowType> {
  header: string;
  width: number;

  value:
    (
      row: RowType,
    ) => string;

  align?:
    | "left"
    | "center"
    | "right";
}

function drawTable<RowType>(
  doc: PDFKit.PDFDocument,
  rows: RowType[],
  columns:
    Array<
      TableColumn<RowType>
    >,
): void {
  const rowHeight = 26;
  const headerHeight = 27;

  let y = doc.y;

  const startX =
    doc.page.margins.left;

  const totalWidth =
    columns.reduce(
      (
        total,
        column,
      ) =>
        total +
        column.width,
      0,
    );

  const drawHeader = (): void => {
    let x = startX;

    doc
      .font("Helvetica-Bold")
      .fontSize(8);

    for (
      const column
      of columns
    ) {
      doc
        .rect(
          x,
          y,
          column.width,
          headerHeight,
        )
        .stroke();

      doc.text(
        column.header,
        x + 4,
        y + 8,
        {
          width:
            column.width - 8,

          align:
            column.align ??
            "left",

          lineBreak: false,
        },
      );

      x += column.width;
    }

    y += headerHeight;
  };

  const addTablePage =
    (): void => {
      doc.addPage();

      y =
        doc.page.margins.top;

      drawHeader();
    };

  ensureVerticalSpace(
    doc,
    headerHeight +
      rowHeight,
  );

  y = doc.y;

  drawHeader();

  for (const row of rows) {
    if (
      y +
        rowHeight >
      doc.page.height -
        doc.page.margins.bottom -
        25
    ) {
      addTablePage();
    }

    let x = startX;

    doc
      .font("Helvetica")
      .fontSize(8);

    for (
      const column
      of columns
    ) {
      doc
        .rect(
          x,
          y,
          column.width,
          rowHeight,
        )
        .stroke();

      doc.text(
        truncateText(
          column.value(row),
          getColumnCharacterLimit(
            column.width,
          ),
        ),
        x + 4,
        y + 8,
        {
          width:
            column.width - 8,

          align:
            column.align ??
            "left",

          lineBreak: false,
        },
      );

      x += column.width;
    }

    y += rowHeight;
  }

  doc.y = y;

  /**
   * Prevent PDFKit's current X position from carrying over
   * after the manually drawn table.
   */
  doc.x =
    startX;

  if (totalWidth <= 0) {
    return;
  }
}

function ensureVerticalSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
): void {
  if (
    doc.y +
      requiredHeight >
    doc.page.height -
      doc.page.margins.bottom -
      25
  ) {
    doc.addPage();
  }
}

function addPageNumbers(
  doc: PDFKit.PDFDocument,
): void {
  const pageRange =
    doc.bufferedPageRange();

  for (
    let index = 0;
    index < pageRange.count;
    index += 1
  ) {
    doc.switchToPage(
      pageRange.start +
        index,
    );

    doc
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Page ${index + 1} of ${pageRange.count}`,
        doc.page.margins.left,
        doc.page.height - 27,
        {
          width:
            doc.page.width -
            doc.page.margins.left -
            doc.page.margins.right,

          align: "center",
          lineBreak: false,
        },
      );
  }
}

function buildReportFilename(
  input: {
    reportType: ReportType;
    month: string;
    selectedEmployee:
      EmployeeInfo | null;
  },
): string {
  if (
    input.reportType ===
      "person" &&
    input.selectedEmployee
  ) {
    return (
      "attendance-" +
      sanitizeFilenamePart(
        input
          .selectedEmployee
          .displayName,
      ) +
      `-${input.month}.pdf`
    );
  }

  return (
    `attendance-month-${input.month}.pdf`
  );
}

function sanitizeFilenamePart(
  value: string,
): string {
  const sanitized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  return (
    sanitized ||
    "employee"
  );
}

function formatMonthLabel(
  month: string,
): string {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      `${month}-01T00:00:00Z`,
    ),
  );
}

function formatAttendanceDate(
  date: string,
): string {
  const milliseconds =
    Date.parse(
      `${date}T00:00:00Z`,
    );

  if (
    Number.isNaN(
      milliseconds,
    )
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(milliseconds),
  );
}

function normalizeStatus(
  status: string,
): string {
  return status
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_",
    );
}

function formatStatus(
  status: string,
): string {
  const normalizedStatus =
    normalizeStatus(status);

  switch (
    normalizedStatus
  ) {
    case "PRESENT":
      return "Present";

    case "ON_LEAVE":
      return "On leave";

    default:
      return normalizedStatus
        .split("_")
        .map(
          (part) =>
            part.charAt(0) +
            part
              .slice(1)
              .toLowerCase(),
        )
        .join(" ");
  }
}

function getColumnCharacterLimit(
  width: number,
): number {
  return Math.max(
    8,
    Math.floor(
      width / 5.4,
    ),
  );
}

function truncateText(
  value: string,
  maximumLength: number,
): string {
  if (
    value.length <=
    maximumLength
  ) {
    return value;
  }

  return (
    value
      .slice(
        0,
        Math.max(
          0,
          maximumLength - 3,
        ),
      )
      .trimEnd() +
    "..."
  );
}

function readQueryString(
  value: unknown,
): string | null {
  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value.trim();

    return (
      normalized ||
      null
    );
  }

  if (
    Array.isArray(value) &&
    typeof value[0] ===
      "string"
  ) {
    const normalized =
      value[0].trim();

    return (
      normalized ||
      null
    );
  }

  return null;
}

function readOptionalString(
  value: unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return (
    normalized ||
    null
  );
}

function readRequiredString(
  value: unknown,
  fieldName: string,
): string {
  const normalized =
    readOptionalString(value);

  if (!normalized) {
    throw new HttpError(
      403,
      `${fieldName} is missing.`,
      "PERMISSION_DENIED",
    );
  }

  return normalized;
}

class HttpError extends Error {
  public readonly statusCode:
    number;

  public readonly status:
    string;

  public constructor(
    statusCode: number,
    message: string,
    status: string,
  ) {
    super(message);

    this.name =
      "HttpError";

    this.statusCode =
      statusCode;

    this.status =
      status;
  }
}
