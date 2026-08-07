-- Bot command queue: dashboard writes commands, bot polls and executes them
CREATE TABLE IF NOT EXISTS bot_commands (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  command TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE bot_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_bot_commands" ON bot_commands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_bot_commands" ON bot_commands
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_bot_commands" ON bot_commands
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_bot_commands" ON bot_commands
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_bot_commands_status ON bot_commands (status);
CREATE INDEX idx_bot_commands_guild_status ON bot_commands (guild_id, status);
