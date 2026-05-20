BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000),
    [email] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'MER_USER',
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[MasterBrand] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [MasterBrand_isActive_df] DEFAULT 1,
    CONSTRAINT [MasterBrand_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MasterBrand_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[MasterBU] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [MasterBU_isActive_df] DEFAULT 1,
    CONSTRAINT [MasterBU_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MasterBU_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[MasterDescription] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [MasterDescription_isActive_df] DEFAULT 1,
    CONSTRAINT [MasterDescription_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MasterDescription_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[MasterGMTType] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [MasterGMTType_isActive_df] DEFAULT 1,
    CONSTRAINT [MasterGMTType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MasterGMTType_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[AirRequest] (
    [id] NVARCHAR(1000) NOT NULL,
    [documentNo] NVARCHAR(1000) NOT NULL,
    [brandName] NVARCHAR(1000) NOT NULL,
    [buName] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [AirRequest_status_df] DEFAULT 'DRAFT',
    [claimDepartment] NVARCHAR(1000),
    [rejectionReason] NVARCHAR(1000),
    [createdById] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AirRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [invoiceNo] NVARCHAR(1000),
    [actualAirFreight] FLOAT(53),
    [bookingDate] DATETIME2,
    [airline] NVARCHAR(1000),
    CONSTRAINT [AirRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AirRequest_documentNo_key] UNIQUE NONCLUSTERED ([documentNo])
);

-- CreateTable
CREATE TABLE [dbo].[AirRequestItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000) NOT NULL,
    [style] NVARCHAR(1000) NOT NULL,
    [so] NVARCHAR(1000) NOT NULL,
    [customerPO] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [gmtType] NVARCHAR(1000),
    [originalShipmentDate] DATETIME2,
    [planShipmentDate] DATETIME2,
    [qtyOriginalShipment] INT NOT NULL,
    [qtyRequestAir] INT NOT NULL,
    [itemStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [AirRequestItem_itemStatus_df] DEFAULT 'PENDING',
    [itemComment] NVARCHAR(1000),
    [reasonDelay] NVARCHAR(1000) NOT NULL,
    [factory] NVARCHAR(1000) NOT NULL,
    [country] NVARCHAR(1000) NOT NULL,
    [port] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [AirRequestItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ApprovalLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [requestId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [fromStatus] NVARCHAR(1000) NOT NULL,
    [toStatus] NVARCHAR(1000) NOT NULL,
    [comment] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ApprovalLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ApprovalLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[AirRequest] ADD CONSTRAINT [AirRequest_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AirRequestItem] ADD CONSTRAINT [AirRequestItem_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[AirRequest]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalLog] ADD CONSTRAINT [ApprovalLog_requestId_fkey] FOREIGN KEY ([requestId]) REFERENCES [dbo].[AirRequest]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalLog] ADD CONSTRAINT [ApprovalLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
