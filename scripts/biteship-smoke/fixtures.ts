/** Shared fixtures for Biteship smoke / matrix scripts. */
import { buildRateItems } from '../../lib/shipping/providers/biteship/rates';
import {
  WAREHOUSE_ORIGIN_LAT,
  WAREHOUSE_ORIGIN_LNG,
} from '../../lib/shipping/constants';

export interface Dest {
  label: string;
  zone: 'bandung' | 'jabodetabek' | 'jawa48h' | 'beyond';
  lat: number;
  lng: number;
  address: string;
  postalCode: string;
  /** Tiers expected to return ≥1 raw quote (soft-warn if empty). */
  expectTiers: Array<'express' | 'frozen_same_day' | 'frozen_express'>;
}

export const ORIGIN = {
  lat: WAREHOUSE_ORIGIN_LAT,
  lng: WAREHOUSE_ORIGIN_LNG,
  address: 'Jl. Sinom V No. 7, Turangga, Bandung',
  contactName: 'Dapur Dekaka Warehouse',
  contactPhone: '6289673737886',
};

/** Destinations across geo-policy zones. */
export const DESTINATIONS: Dest[] = [
  {
    label: 'Bandung-Wetan',
    zone: 'bandung',
    lat: -6.9175,
    lng: 107.6191,
    address: 'Jl. Asia Afrika, Bandung Wetan, Kota Bandung',
    postalCode: '40111',
    expectTiers: ['express', 'frozen_same_day', 'frozen_express'],
  },
  {
    label: 'Bandung-Buahbatu',
    zone: 'bandung',
    lat: -6.9645,
    lng: 107.6612,
    address: 'Jl. Bojongsoang, Buahbatu, Bandung',
    postalCode: '40287',
    expectTiers: ['express', 'frozen_same_day', 'frozen_express'],
  },
  {
    label: 'Jakarta-Selatan',
    zone: 'jabodetabek',
    lat: -6.28927,
    lng: 106.77492,
    address: 'Lebak Bulus, Cilandak, Jakarta Selatan',
    postalCode: '12310',
    expectTiers: ['frozen_same_day', 'frozen_express'],
  },
  {
    label: 'Bekasi',
    zone: 'jabodetabek',
    lat: -6.2383,
    lng: 106.9756,
    address: 'Jl. Ahmad Yani, Bekasi Barat, Kota Bekasi',
    postalCode: '17141',
    expectTiers: ['frozen_same_day', 'frozen_express'],
  },
  {
    label: 'Surabaya',
    zone: 'jawa48h',
    lat: -7.2575,
    lng: 112.7521,
    address: 'Jl. Tunjungan, Genteng, Surabaya',
    postalCode: '60275',
    expectTiers: ['frozen_express'],
  },
  {
    label: 'Yogyakarta',
    zone: 'jawa48h',
    lat: -7.7956,
    lng: 110.3695,
    address: 'Jl. Malioboro, Yogyakarta',
    postalCode: '55213',
    expectTiers: ['frozen_express'],
  },
  {
    label: 'Medan',
    zone: 'beyond',
    lat: 3.5952,
    lng: 98.6722,
    address: 'Jl. Gatot Subroto, Medan',
    postalCode: '20112',
    expectTiers: [],
  },
];

export const MAP_QUERIES = [
  'Bandung',
  'Jakarta Selatan',
  'Bekasi',
  'Surabaya',
  'Yogyakarta',
];

export const COURIERS_ALL = [
  'gojek',
  'grab',
  'paxel',
  'anteraja',
  'sicepat',
  'jne',
] as const;

export const ITEMS_LIGHT = buildRateItems([
  {
    name: 'Dimsum Crabstick light',
    value: 75000,
    weightGram: 1000,
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
    quantity: 1,
  },
]);

export const ITEMS_HEAVY = buildRateItems([
  {
    name: 'Dimsum mix heavy',
    value: 250000,
    weightGram: 4000,
    lengthCm: 30,
    widthCm: 25,
    heightCm: 20,
    quantity: 2,
  },
]);

export const ITEMS_MULTI = buildRateItems([
  {
    name: 'Dimsum Crabstick',
    value: 75000,
    weightGram: 1000,
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
    quantity: 1,
  },
  {
    name: 'Pangsit Ayam',
    value: 65000,
    weightGram: 1000,
    lengthCm: 18,
    widthCm: 14,
    heightCm: 8,
    quantity: 2,
  },
]);
