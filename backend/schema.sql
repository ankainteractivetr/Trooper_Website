-- ============================================================
--  Caner 'Trooper' Kurt — WebGPU site  |  MySQL schema
--  Run with:  npm run db:setup   (creates DB + tables)
--  Or manually:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS trooper
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE trooper;

-- Single-row table holding the page title + about text.
CREATE TABLE IF NOT EXISTS site_content (
  id          INT PRIMARY KEY DEFAULT 1,
  title       VARCHAR(255) NOT NULL DEFAULT 'Caner \'Trooper\' Kurt',
  subtitle    VARCHAR(255) NOT NULL DEFAULT 'Computer Programmer | Writer',
  -- About body stored as HTML rich text (may contain links). Justified on the site.
  about       MEDIUMTEXT NOT NULL,
  accent      VARCHAR(16) NOT NULL DEFAULT '#ff2d2d',
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Social links rendered in the bottom bar.
CREATE TABLE IF NOT EXISTS social_links (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  platform    VARCHAR(64)  NOT NULL,
  url         VARCHAR(512) NOT NULL,
  icon        VARCHAR(255) NOT NULL,          -- filename inside uploads/social OR full URL
  sort_order  INT NOT NULL DEFAULT 0,
  enabled     TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Frames shown on the rotating 3D film reel (left side).
CREATE TABLE IF NOT EXISTS reel_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL,          -- file inside uploads/reel
  caption     VARCHAR(255) NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  enabled     TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);