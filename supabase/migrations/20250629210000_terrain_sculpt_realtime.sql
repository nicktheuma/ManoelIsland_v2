-- Enable live sculpt stroke sync (same publication pattern as placed_props)

alter publication supabase_realtime add table public.terrain_sculpt_strokes;
