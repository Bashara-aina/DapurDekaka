'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AreaSearchInput, type AreaSuggestion } from '@/components/store/checkout/AreaSearchInput';

export interface MapPinValue {
  latitude: number;
  longitude: number;
  addressLine: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

interface AddressMapPickerProps {
  defaultValues?: Partial<MapPinValue>;
  onConfirm: (value: MapPinValue) => void;
  onBack?: () => void;
  className?: string;
  defaultCity?: string;
  defaultProvince?: string;
}

interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

interface GoogleMapMouseEvent {
  latLng: GoogleLatLng | null;
}

interface GoogleMapsApi {
  maps: {
    Map: new (el: HTMLElement, opts: object) => { addListener: (event: string, cb: (e: GoogleMapMouseEvent) => void) => void };
    Marker: new (opts: object) => {
      setPosition: (pos: GoogleLatLng) => void;
      addListener: (event: string, cb: () => void) => void;
      getPosition: () => GoogleLatLng | null;
    };
  };
}

const DEFAULT_LAT = -6.958;
const DEFAULT_LNG = 107.636;

/**
 * Google Maps pin picker for delivery addresses.
 */
export function AddressMapPicker({
  defaultValues,
  onConfirm,
  onBack,
  className,
  defaultCity = '',
  defaultProvince = '',
}: AddressMapPickerProps) {
  const t = useTranslations('checkout');
  const mapRef = useRef<HTMLDivElement>(null);
  const [lat, setLat] = useState(defaultValues?.latitude ?? DEFAULT_LAT);
  const [lng, setLng] = useState(defaultValues?.longitude ?? DEFAULT_LNG);
  const [addressLine, setAddressLine] = useState(defaultValues?.addressLine ?? '');
  const [district, setDistrict] = useState(defaultValues?.district ?? '');
  const [city, setCity] = useState(defaultValues?.city ?? defaultCity);
  const [province, setProvince] = useState(defaultValues?.province ?? defaultProvince);
  const [postalCode, setPostalCode] = useState(defaultValues?.postalCode ?? '');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapsLoadFailed, setMapsLoadFailed] = useState(false);
  const [postalError, setPostalError] = useState('');

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      setMapsLoadFailed(true);
      return;
    }
    if (mapReady) return;
    const timeout = setTimeout(() => {
      const g = (window as Window & { google?: GoogleMapsApi }).google;
      if (!mapReady && !g?.maps) {
        setMapsLoadFailed(true);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [mapReady]);

  const initMap = useCallback(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !mapRef.current || mapReady) return;

    const google = (window as Window & { google?: GoogleMapsApi }).google;
    if (!google?.maps) return;

    const center = { lat, lng };
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
    });

    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: true,
    });

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (pos) {
        setLat(pos.lat());
        setLng(pos.lng());
      }
    });

    map.addListener('click', (e: GoogleMapMouseEvent) => {
      if (!e.latLng) return;
      marker.setPosition(e.latLng);
      setLat(e.latLng.lat());
      setLng(e.latLng.lng());
    });

    setMapReady(true);
  }, [lat, lng, mapReady]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    const existing = document.getElementById('google-maps-script');
    if (existing) {
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, [initMap]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLoadingGeo(false);
        setMapReady(false);
        setTimeout(initMap, 100);
      },
      () => setLoadingGeo(false)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine.trim()) {
      e.currentTarget.querySelector<HTMLInputElement>('#addressLine')?.reportValidity();
      return;
    }
    const postal = postalCode.trim();
    if (!/^\d{5}$/.test(postal)) {
      setPostalError(t('postalCodeInvalid'));
      return;
    }
    setPostalError('');
    onConfirm({
      latitude: lat,
      longitude: lng,
      addressLine: addressLine.trim(),
      district: district.trim() || city,
      city: city.trim() || defaultCity,
      province: province.trim() || defaultProvince,
      postalCode: postal,
    });
  };

  const applyAreaSuggestion = (area: AreaSuggestion): void => {
    // Biteship name is typically "District, City, Province, Country"
    const parts = area.name.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      setDistrict(parts[0] ?? '');
      setCity(parts[1] ?? '');
      setProvince(parts[2] ?? '');
    } else if (parts.length === 2) {
      setCity(parts[0] ?? '');
      setProvince(parts[1] ?? '');
    }
    if (area.postal_code) {
      setPostalCode(String(area.postal_code).padStart(5, '0').slice(0, 5));
      setPostalError('');
    }
    if (!addressLine.trim()) {
      setAddressLine(area.name);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <AreaSearchInput onSelect={applyAreaSuggestion} />

      {!mapsLoadFailed ? (
        <>
          <div
            ref={mapRef}
            className="w-full h-48 md:h-64 rounded-card bg-brand-cream-dark overflow-hidden"
            aria-label={t('mapPinLabel')}
          />

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={useMyLocation}
            disabled={loadingGeo}
          >
            {loadingGeo ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <MapPin className="w-4 h-4 mr-2" />
            )}
            {t('useMyLocation')}
          </Button>

          <div className="rounded-lg bg-brand-cream-dark/50 px-3 py-2 text-xs text-text-secondary">
            <p>{t('pinConfirm', { lat: lat.toFixed(5), lng: lng.toFixed(5) })}</p>
            <p className="mt-1 font-medium text-text-primary">
              {[addressLine, district, city, province].filter(Boolean).join(', ') || t('pinConfirmEmpty')}
            </p>
          </div>
        </>
      ) : (
        <div className="bg-warning-light border border-warning/30 rounded-card p-4 text-sm text-warning">
          <p>{t('mapLoadFailedManual')}</p>
        </div>
      )}

      <div>
        <Label htmlFor="addressLine">{t('addressLine')}</Label>
        <Input
          id="addressLine"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          required
          className="mt-1"
          placeholder={t('addressSearchPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="district">{t('district')}</Label>
          <Input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="city">{t('city')}</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="province">{t('province')}</Label>
          <Input id="province" value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="postalCode">{t('postalCode')}</Label>
          <Input
            id="postalCode"
            value={postalCode}
            onChange={(e) => {
              setPostalCode(e.target.value);
              setPostalError('');
            }}
            required
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            className="mt-1"
          />
          {postalError ? <p className="text-xs text-error mt-1">{postalError}</p> : null}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {onBack && (
          <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
            {t('back')}
          </Button>
        )}
        <Button type="submit" className="flex-1 bg-brand-red hover:bg-brand-red-dark">
          {t('continueToCourier')}
        </Button>
      </div>
    </form>
  );
}
