/*
  Run this once against SQL Server before setting DB_SERVER in .env.
  The MVP remains usable with JSON persistence for local simulation.
*/
CREATE TABLE dbo.Viewers (
  viewer_id NVARCHAR(128) NOT NULL PRIMARY KEY,
  username NVARCHAR(128) NULL,
  nickname NVARCHAR(256) NULL,
  avatar_url NVARCHAR(1024) NULL,
  last_seen_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.TemplePresences (
  viewer_id NVARCHAR(128) NOT NULL PRIMARY KEY,
  state NVARCHAR(24) NOT NULL,
  slot_index INT NULL,
  joined_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  last_active_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_TemplePresences_Viewer FOREIGN KEY (viewer_id) REFERENCES dbo.Viewers(viewer_id)
);
CREATE UNIQUE NONCLUSTERED INDEX UQ_TemplePresences_Slot ON dbo.TemplePresences(slot_index) WHERE slot_index IS NOT NULL;

CREATE TABLE dbo.GiftConfigs (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  provider_gift_id NVARCHAR(128) NOT NULL UNIQUE,
  name NVARCHAR(256) NOT NULL,
  image_url NVARCHAR(1024) NULL,
  animation NVARCHAR(64) NOT NULL,
  sound_url NVARCHAR(1024) NULL,
  duration_ms INT NOT NULL,
  thank_you_template NVARCHAR(500) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  special_effect NVARCHAR(64) NOT NULL DEFAULT 'none',
  enabled BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.GiftEvents (
  external_event_id NVARCHAR(200) NOT NULL PRIMARY KEY,
  viewer_id NVARCHAR(128) NULL,
  provider_gift_id NVARCHAR(128) NOT NULL,
  repeat_count INT NOT NULL DEFAULT 1,
  received_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.AudioTracks (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  title NVARCHAR(256) NOT NULL,
  file_path NVARCHAR(1024) NOT NULL,
  duration_ms INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.AppSettings (
  [key] NVARCHAR(128) NOT NULL PRIMARY KEY,
  value_json NVARCHAR(MAX) NOT NULL,
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
