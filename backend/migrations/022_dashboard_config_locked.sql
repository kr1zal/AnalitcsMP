-- Migration 022: Add locked column to user_dashboard_config
-- Allows users to lock widget positions (prevent drag-and-drop rearrangement)

ALTER TABLE user_dashboard_config
ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
