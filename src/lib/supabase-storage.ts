import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SECRET_KEY || "placeholder"
)

export const BUCKET = "air-request-attachments"
