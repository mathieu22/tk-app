-- CreateTable
CREATE TABLE "Association" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "currentSchoolYear" TEXT NOT NULL,
    "schoolYearStartMon" INTEGER NOT NULL DEFAULT 9,
    "newMemberDays" INTEGER NOT NULL DEFAULT 30,
    "thresholdGreen" INTEGER NOT NULL DEFAULT 80,
    "thresholdOrange" INTEGER NOT NULL DEFAULT 50,
    "colors" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricule" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "birthPlace" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Malagasy',
    "bloodGroup" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "facebook" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "position" TEXT NOT NULL DEFAULT 'ATHLETE',
    "photoUrl" TEXT,
    "groupId" TEXT,
    "licenseNo" TEXT,
    "kukkiwonNo" TEXT,
    "medicalInfo" TEXT,
    "qrToken" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    CONSTRAINT "Parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "parentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    PRIMARY KEY ("parentId", "memberId"),
    CONSTRAINT "ParentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentLink_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "groupId" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "participationMode" TEXT NOT NULL DEFAULT 'OPEN',
    "maxSeats" INTEGER,
    "registrationUntil" DATETIME,
    "fee" INTEGER,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EventType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    CONSTRAINT "EventDay_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'PENDING',
    "waitlistRank" INTEGER,
    "parentalConsent" DATETIME,
    "respondedById" TEXT,
    "respondedAt" DATETIME,
    CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "eventDayId" TEXT,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "scannedAt" DATETIME,
    "leftAt" DATETIME,
    "mode" TEXT NOT NULL DEFAULT 'QR',
    "recordedBy" TEXT,
    CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_eventDayId_fkey" FOREIGN KEY ("eventDayId") REFERENCES "EventDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feeTypeId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "groupId" TEXT,
    CONSTRAINT "Tariff_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Due" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 0,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    CONSTRAINT "Due_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Due_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNo" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "operator" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "paymentId" TEXT NOT NULL,
    "dueId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    PRIMARY KEY ("paymentId", "dueId"),
    CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_dueId_fkey" FOREIGN KEY ("dueId") REFERENCES "Due" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeGrid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gridId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "beltLabel" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "mainColor" TEXT NOT NULL,
    "stripeColor" TEXT,
    "stripeCount" INTEGER NOT NULL DEFAULT 0,
    "poomsae" TEXT,
    "drawRule" TEXT,
    "minMonths" INTEGER NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Grade_gridId_fkey" FOREIGN KEY ("gridId") REFERENCES "GradeGrid" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradePassage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "jury" TEXT,
    "mention" TEXT,
    "observation" TEXT,
    "certificate" TEXT,
    CONSTRAINT "GradePassage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradePassage_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeighIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" REAL NOT NULL,
    CONSTRAINT "WeighIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_matricule_key" ON "Member"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Member_qrToken_key" ON "Member"("qrToken");

-- CreateIndex
CREATE INDEX "Member_lastName_firstName_idx" ON "Member"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_userId_key" ON "Parent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_phone_key" ON "Parent"("phone");

-- CreateIndex
CREATE INDEX "Session_date_idx" ON "Session"("date");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_label_key" ON "EventType"("label");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_memberId_key" ON "EventRegistration"("eventId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_memberId_key" ON "Attendance"("sessionId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_eventDayId_memberId_key" ON "Attendance"("eventDayId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeType_code_key" ON "FeeType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_feeTypeId_schoolYear_groupId_key" ON "Tariff"("feeTypeId", "schoolYear", "groupId");

-- CreateIndex
CREATE INDEX "Due_feeTypeId_schoolYear_month_idx" ON "Due"("feeTypeId", "schoolYear", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Due_memberId_feeTypeId_schoolYear_month_key" ON "Due"("memberId", "feeTypeId", "schoolYear", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "GradeGrid_name_key" ON "GradeGrid"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_gridId_kind_number_key" ON "Grade"("gridId", "kind", "number");
