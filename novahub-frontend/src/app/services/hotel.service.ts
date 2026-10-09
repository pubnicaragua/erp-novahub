import { api } from './api';
import type { RestaurantMenuCategory, RestaurantPublicBranding } from './restaurant.service';

export type HotelReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export interface HotelRoomType {
  id: string;
  branchId: string;
  rateProductId: string;
  code: string;
  name: string;
  capacity: number;
  isActive: boolean;
  rateProduct?: { id: string; code?: string; name: string; salePrice: number; priceCurrency: string; type: 'SERVICE'; isActive?: boolean };
  _count?: { rooms: number };
}

export interface HotelRoom {
  id: string;
  branchId: string;
  roomTypeId: string;
  code: string;
  name: string;
  floor?: string | null;
  isActive: boolean;
  roomType: HotelRoomType;
}

export interface HotelReservation {
  id: string;
  branchId: string;
  roomId: string;
  reservationNumber: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkIn: string;
  checkOut: string;
  status: HotelReservationStatus;
  nightlyRate: number;
  taxRate: number;
  currency: string;
  exchangeRate: number;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  invoiceId?: string | null;
  guestLinkActive?: boolean;
  room?: HotelRoom;
  invoice?: { id: string; number: string; status: string } | null;
  restaurantOrders?: Array<{ id: string; number: string; status: string; total: number; currency: string; createdAt: string }>;
}

export const hotelService = {
  listRoomTypes: (branchId: string, signal?: AbortSignal) => api.get<HotelRoomType[]>('/hotel/room-types', { params: { branchId }, signal }),
  createRoomType: (body: { branchId: string; rateProductId: string; code: string; name: string; capacity: number }) => api.post<HotelRoomType>('/hotel/room-types', body),
  updateRoomType: (id: string, body: Partial<Pick<HotelRoomType, 'rateProductId' | 'code' | 'name' | 'capacity' | 'isActive'>>) => api.patch<HotelRoomType>(`/hotel/room-types/${id}`, body),
  listRooms: (branchId: string, signal?: AbortSignal) => api.get<HotelRoom[]>('/hotel/rooms', { params: { branchId }, signal }),
  createRoom: (body: { branchId: string; roomTypeId: string; code: string; name: string; floor?: string }) => api.post<HotelRoom>('/hotel/rooms', body),
  updateRoom: (id: string, body: Partial<Pick<HotelRoom, 'roomTypeId' | 'code' | 'name' | 'floor' | 'isActive'>>) => api.patch<HotelRoom>(`/hotel/rooms/${id}`, body),
  availability: (params: { branchId: string; checkIn: string; checkOut: string }, signal?: AbortSignal) => api.get<HotelRoom[]>('/hotel/availability', { params, signal }),
  listReservations: (params?: { branchId?: string; checkInFrom?: string; checkInTo?: string; status?: string }, signal?: AbortSignal) => api.get<HotelReservation[]>('/hotel/reservations', { params, signal }),
  getReservation: (id: string, signal?: AbortSignal) => api.get<HotelReservation>(`/hotel/reservations/${id}`, { signal }),
  createReservation: (body: { branchId: string; roomId: string; guestName: string; guestEmail?: string; guestPhone?: string; checkIn: string; checkOut: string }) => api.idempotentPost<HotelReservation>('/hotel/reservations', body),
  updateReservation: (id: string, body: Partial<Pick<HotelReservation, 'roomId' | 'guestName' | 'guestEmail' | 'guestPhone' | 'checkIn' | 'checkOut'>>) => api.patch<HotelReservation>(`/hotel/reservations/${id}`, body),
  checkIn: (id: string) => api.idempotentPost<HotelReservation>(`/hotel/reservations/${id}/check-in`, {}),
  checkOut: (id: string, body: { registerId: string; sessionId: string; payments: Array<{ method: string; amount: number; currency: string }> }) => api.idempotentPost<HotelReservation>(`/hotel/reservations/${id}/check-out`, body),
  cancel: (id: string) => api.idempotentPost<HotelReservation>(`/hotel/reservations/${id}/cancel`, {}),
  noShow: (id: string) => api.idempotentPost<HotelReservation>(`/hotel/reservations/${id}/no-show`, {}),
  issueGuestLink: (id: string) => api.idempotentPost<{ token: string; reservationNumber: string }>(`/hotel/reservations/${id}/guest-link`, {}),
  revokeGuestLink: (id: string) => api.idempotentPost<{ success: boolean }>(`/hotel/reservations/${id}/guest-link/revoke`, {}),
  getGuestMenu: (token: string, signal?: AbortSignal) => api.get<{ table: { name: string; code: string }; categories: RestaurantMenuCategory[]; branding: RestaurantPublicBranding }>(`/hotel/public/${encodeURIComponent(token)}/menu`, { signal }),
  createGuestOrder: (token: string, body: { items: Array<{ menuItemId: string; quantity: number; selectedOptions?: Record<string, string | string[]> }>; notes?: string }) => api.idempotentPost<any>(`/hotel/public/${encodeURIComponent(token)}/orders`, body),
};
