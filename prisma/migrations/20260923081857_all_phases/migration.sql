-- AlterTable
ALTER TABLE "Grade" ADD COLUMN "minAge" INTEGER;
ALTER TABLE "Grade" ADD COLUMN "minAttendance" INTEGER;

-- AlterTable
ALTER TABLE "Parent" ADD COLUMN "qrToken" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "cancelledById" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "seriesId" TEXT;

-- AlterTable
ALTER TABLE "WeighIn" ADD COLUMN "recordedById" TEXT;

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventDayId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    CONSTRAINT "ParentAttendance_eventDayId_fkey" FOREIGN KEY ("eventDayId") REFERENCES "EventDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentAttendance_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeMapping" (
    "childGradeId" TEXT NOT NULL PRIMARY KEY,
    "adultGradeId" TEXT NOT NULL,
    CONSTRAINT "GradeMapping_childGradeId_fkey" FOREIGN KEY ("childGradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeMapping_adultGradeId_fkey" FOREIGN KEY ("adultGradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeExam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "date" DATETIME NOT NULL,
    "location" TEXT,
    "jury" TEXT,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeExam_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "targetGradeId" TEXT NOT NULL,
    "drawnPoomsae" TEXT,
    "scores" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    CONSTRAINT "ExamCandidate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "GradeExam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamCandidate_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamCandidate_targetGradeId_fkey" FOREIGN KEY ("targetGradeId") REFERENCES "Grade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AgeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AgeCategory_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeightCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ageCategoryId" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxKg" REAL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "WeightCategory_ageCategoryId_fkey" FOREIGN KEY ("ageCategoryId") REFERENCES "AgeCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllowedPoomsae" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER,
    "poomsae" TEXT NOT NULL,
    CONSTRAINT "AllowedPoomsae_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "seasonId" TEXT,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "location" TEXT,
    "level" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "organizer" TEXT,
    "posterUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Competition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "ageCategory" TEXT,
    "sex" TEXT NOT NULL,
    "weightCategory" TEXT,
    "weighInKg" REAL,
    "outcome" TEXT NOT NULL,
    "rank" INTEGER,
    "score" TEXT,
    "details" TEXT NOT NULL DEFAULT '[]',
    "teamName" TEXT,
    "observation" TEXT,
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Result_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Result_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "operator" TEXT,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "OperationCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "categoryId" TEXT,
    "amount" INTEGER NOT NULL,
    "counterparty" TEXT,
    "description" TEXT,
    "proofUrl" TEXT,
    "paymentId" TEXT,
    "transferAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelReason" TEXT,
    "cancelledAt" DATETIME,
    CONSTRAINT "Operation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TreasuryAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Operation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OperationCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Operation_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "TreasuryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYear" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OperationCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Association" (
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
    "colors" TEXT NOT NULL DEFAULT '{}',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "weightAlertKg" REAL NOT NULL DEFAULT 1,
    "weighInMaxDays" INTEGER NOT NULL DEFAULT 30,
    "poomToDanAge" INTEGER NOT NULL DEFAULT 15,
    "expenseApprovalMin" INTEGER NOT NULL DEFAULT 200000,
    "receiptFooter" TEXT
);
INSERT INTO "new_Association" ("address", "colors", "currentSchoolYear", "id", "logoUrl", "name", "newMemberDays", "phone", "schoolYearStartMon", "thresholdGreen", "thresholdOrange") SELECT "address", "colors", "currentSchoolYear", "id", "logoUrl", "name", "newMemberDays", "phone", "schoolYearStartMon", "thresholdGreen", "thresholdOrange" FROM "Association";
DROP TABLE "Association";
ALTER TABLE "new_Association" RENAME TO "Association";
CREATE TABLE "new_Due" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 0,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "eventId" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Due_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Due_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Due_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Due" ("amountDue", "amountPaid", "feeTypeId", "id", "memberId", "month", "schoolYear", "status") SELECT "amountDue", "amountPaid", "feeTypeId", "id", "memberId", "month", "schoolYear", "status" FROM "Due";
DROP TABLE "Due";
ALTER TABLE "new_Due" RENAME TO "Due";
CREATE INDEX "Due_feeTypeId_schoolYear_month_idx" ON "Due"("feeTypeId", "schoolYear", "month");
CREATE UNIQUE INDEX "Due_memberId_feeTypeId_schoolYear_month_eventKey_key" ON "Due"("memberId", "feeTypeId", "schoolYear", "month", "eventKey");
CREATE TABLE "new_Event" (
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
    "audienceGroupIds" TEXT NOT NULL DEFAULT '[]',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EventType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("audience", "createdAt", "createdById", "description", "endDate", "fee", "id", "location", "maxSeats", "participationMode", "registrationUntil", "startDate", "title", "typeId") SELECT "audience", "createdAt", "createdById", "description", "endDate", "fee", "id", "location", "maxSeats", "participationMode", "registrationUntil", "startDate", "title", "typeId" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
CREATE TABLE "new_GradePassage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "jury" TEXT,
    "mention" TEXT,
    "observation" TEXT,
    "certificate" TEXT,
    "proofUrl" TEXT,
    "examId" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradePassage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradePassage_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GradePassage" ("certificate", "date", "gradeId", "id", "jury", "memberId", "mention", "observation") SELECT "certificate", "date", "gradeId", "id", "jury", "memberId", "mention", "observation" FROM "GradePassage";
DROP TABLE "GradePassage";
ALTER TABLE "new_GradePassage" RENAME TO "GradePassage";
CREATE INDEX "GradePassage_memberId_date_idx" ON "GradePassage"("memberId", "date");
CREATE TABLE "new_Member" (
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
    "photoConsent" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("address", "archived", "birthDate", "birthPlace", "bloodGroup", "createdAt", "email", "facebook", "firstName", "groupId", "id", "joinedAt", "kukkiwonNo", "lastName", "licenseNo", "matricule", "medicalInfo", "nationality", "phone", "photoUrl", "position", "qrToken", "sex", "status", "updatedAt") SELECT "address", "archived", "birthDate", "birthPlace", "bloodGroup", "createdAt", "email", "facebook", "firstName", "groupId", "id", "joinedAt", "kukkiwonNo", "lastName", "licenseNo", "matricule", "medicalInfo", "nationality", "phone", "photoUrl", "position", "qrToken", "sex", "status", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_matricule_key" ON "Member"("matricule");
CREATE UNIQUE INDEX "Member_qrToken_key" ON "Member"("qrToken");
CREATE INDEX "Member_lastName_firstName_idx" ON "Member"("lastName", "firstName");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "notificationPrefs" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "memberId", "passwordHash", "phone", "profile") SELECT "active", "createdAt", "email", "id", "memberId", "passwordHash", "phone", "profile" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAttendance_eventDayId_parentId_key" ON "ParentAttendance"("eventDayId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeExam_eventId_key" ON "GradeExam"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCandidate_examId_memberId_key" ON "ExamCandidate"("examId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");

-- CreateIndex
CREATE UNIQUE INDEX "AgeCategory_seasonId_name_key" ON "AgeCategory"("seasonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_eventId_key" ON "Competition"("eventId");

-- CreateIndex
CREATE INDEX "Competition_startDate_idx" ON "Competition"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "OperationCategory_name_type_key" ON "OperationCategory"("name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_paymentId_key" ON "Operation"("paymentId");

-- CreateIndex
CREATE INDEX "Operation_accountId_date_idx" ON "Operation"("accountId", "date");

-- CreateIndex
CREATE INDEX "Operation_date_idx" ON "Operation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_schoolYear_categoryId_key" ON "Budget"("schoolYear", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_qrToken_key" ON "Parent"("qrToken");

-- CreateIndex
CREATE INDEX "WeighIn_memberId_date_idx" ON "WeighIn"("memberId", "date");

