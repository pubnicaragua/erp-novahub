import { PublicRestaurantMenuPage } from './PublicRestaurantMenuPage';

export function PublicHotelGuestPage({ token }: { token: string }) {
  return <PublicRestaurantMenuPage hotelToken={token} />;
}
