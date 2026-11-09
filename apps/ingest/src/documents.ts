/** Document shapes, one per index. Field names match packages/es-client mappings. */
export interface SessionDoc {
  id: string;
  title: string;
  abstract: string;
  speakers: string[];
  track: string;
  level: string;
  day: string;
  start: string;
  end: string;
  room: string;
  venue: string;
  colocated_event: string;
  tags: string[];
  captioned: boolean;
  recorded: boolean;
  url: string;
  embedding?: number[];
}

export interface SpeakerDoc {
  id: string;
  name: string;
  org: string;
  bio: string;
  session_ids: string[];
  topics: string[];
  embedding?: number[];
}

export interface RoomDoc {
  id: string;
  venue: string;
  level: string;
  name: string;
  capacity?: number;
  wheelchair_route: string;
  captioning: string;
  hearing_loop: boolean;
  quiet_room_nearby: string;
  nearest_accessible_restroom: string;
}

export interface ExhibitorDoc {
  id: string;
  name: string;
  booth: string;
  tier: string;
  description: string;
  categories: string[];
  hall: string;
  url: string;
  embedding?: number[];
}

export interface SideEventDoc {
  id: string;
  name: string;
  host: string;
  start: string;
  end: string;
  address: string;
  geo?: { lat: number; lon: number };
  rsvp_url: string;
  capacity_note: string;
  description: string;
  badge_required: boolean;
  accessibility_note: string;
  embedding?: number[];
}
