export type User = { id: string; email: string; password_hash: string };
export type Region = { id: string; code: string; name: string };
export type Subarea = { id: string; region_id: string; code: string; name: string; highlight_image_url: string | null };
export type Spot = { id: string; subarea_id: string; code: string; description: string | null };

export type BookingDTO = {
  id: string;
  spot_id: string;
  user_id: string;
  time_range: string;   // tstzrange literal
  comment: string | null;
  status: 'active' | 'cancelled';
};
