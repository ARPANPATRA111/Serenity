export interface EventLink {
  label: string;
  url: string;
}

export interface SerenityEvent {
  id: string;
  userId: string;
  name: string;
  type: string;
  description?: string;
  organizerName?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  venueName?: string;
  address?: string;
  city?: string;
  country?: string;
  websiteUrl?: string;
  registrationUrl?: string;
  coverImageUrl?: string;
  galleryImageUrls: string[];
  links: EventLink[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type EventInput = Omit<
  SerenityEvent,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'archivedAt'
>;

export type PublicEventContext = Pick<
  SerenityEvent,
  | 'id'
  | 'name'
  | 'type'
  | 'description'
  | 'organizerName'
  | 'startAt'
  | 'endAt'
  | 'timezone'
  | 'venueName'
  | 'address'
  | 'city'
  | 'country'
  | 'websiteUrl'
  | 'registrationUrl'
  | 'coverImageUrl'
  | 'galleryImageUrls'
  | 'links'
  | 'tags'
>;
