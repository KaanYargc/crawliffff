"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Constants for controlling search behavior
const MAX_SEARCH_POINTS = 35; // Increased from 30 to 35
const MAX_PAGES = 3; // Maximum number of pages to fetch per search point
const DELAY_BETWEEN_SEARCHES = 1200; // Increased from 1000 to 1200 ms to avoid rate limiting
const RADIUS_VARIATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]; // Added more radius variations
const MAX_RESULTS_TARGET = 120; // Target for maximum results

// Added keyword variation constants to improve search coverage
const KEYWORD_VARIATIONS = {
  // Example for plumbers in Turkish
  "tesisatçı": ["tesisatçı", "su tesisatçısı", "tesisat tamiri", "sıhhi tesisat", "tesisat ustası"],
  // Add more variations for other common search terms
};

// Added business categories that can help find more places
const BUSINESS_CATEGORIES = {
  "tesisatçı": ["plumber", "home_service", "store", "point_of_interest", "establishment"],
  // Add more categories for other common search terms
};

// Helper to get jittered coordinates to avoid API clustering
const getJitteredCoordinates = (lat: number, lng: number, jitterAmount: number = 0.0005): {lat: number, lng: number} => {
  return {
    lat: lat + (Math.random() * 2 - 1) * jitterAmount,
    lng: lng + (Math.random() * 2 - 1) * jitterAmount
  };
};

// Added time-based search parameters
const TIME_VARIATIONS = [
  { openNow: true },  // Currently open businesses
  { openNow: false }, // All businesses regardless of opening hours
  {}                  // Default (no time filter)
];

// Generate four quadrants around a center point
const generateQuadrants = (center: { lat: number; lng: number }, offset: number): { lat: number; lng: number }[] => {
  return [
    { lat: center.lat + offset, lng: center.lng + offset }, // Northeast
    { lat: center.lat + offset, lng: center.lng - offset }, // Northwest
    { lat: center.lat - offset, lng: center.lng + offset }, // Southeast
    { lat: center.lat - offset, lng: center.lng - offset }  // Southwest
  ];
};

// Enhanced function to fetch nearby search results using the new Places API
const fetchNearbySearchResults = async (
  location: { lat: number; lng: number },
  keyword: string,
  radius: number,
  type: string = "",
  timeParams: { openNow?: boolean } = {}
): Promise<BusinessLocation[]> => {
  try {
    // Create the request body
    const requestBody = {
      includedTypes: type ? [type] : undefined,
      locationRestriction: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: radius
        }
      },
      maxResultCount: 20,
      openNow: timeParams.openNow,
      query: keyword
    };
    
    // Create the Headers object
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount'
    });
    
    // Make the request to the new Places API
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchNearby?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Nearby search API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Nearby search response:", data);
    
    // Handle case where no results are found
    if (!data.places || data.places.length === 0) {
      return [];
    }
    
    // Map the results to our BusinessLocation interface
    const businesses: BusinessLocation[] = data.places.map((place: any) => ({
      place_id: place.id || `unknown-${Math.random()}`,
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || 'Unknown Address',
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0
      },
      categories: place.types || [],
      phoneNumber: '', // Will be populated later
      email: '', // Will be populated later
      website: '', // Will be populated later
      rating: place.rating || 0,
      userRatingsTotal: place.userRatingCount || 0
    }));
    
    return businesses;
  } catch (error) {
    console.error("Error in new Places API nearby search:", error);
    
    // Fallback to legacy API if the new API fails
    console.log("Falling back to legacy Places API for nearby search");
    
    // Create the request parameters for legacy API
    const params: any = {
      location: new google.maps.LatLng(location.lat, location.lng),
      radius: radius,
      keyword: keyword
    };
    
    // Add optional parameters if provided
    if (type) params.type = type;
    if (timeParams.openNow !== undefined) params.openNow = timeParams.openNow;
    
    // Create the Places service
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    
    // Perform the nearby search with legacy API
    return new Promise((resolve, reject) => {
      service.nearbySearch(params, (results, status, pagination) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          // Map the results to our BusinessLocation interface
          const businesses = results.map(result => ({
            place_id: result.place_id || `unknown-${Math.random()}`,
            name: result.name || 'Unknown',
            address: result.vicinity || 'Unknown Address',
            location: {
              lat: result.geometry?.location?.lat() || 0,
              lng: result.geometry?.location?.lng() || 0
            },
            categories: result.types || [],
            phoneNumber: '', // Will be populated later
            email: '', // Will be populated later
            website: '', // Will be populated later
            rating: result.rating || 0,
            userRatingsTotal: result.user_ratings_total || 0
          }));
          
          resolve(businesses);
        } else {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error(`Legacy nearby search failed with status: ${status}`));
          }
        }
      });
    });
  }
};

// Enhanced function to generate search points with adaptive grid density
const generateSearchGrid = (center: { lat: number; lng: number }, radius: number): { lat: number; lng: number }[] => {
  const points: { lat: number; lng: number }[] = [];
  
  // 1. Add center point
  points.push({ ...center });
  
  // 2. Add grid points
  const gridSize = 3; // 3x3 grid
  const step = radius / (gridSize - 1);
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (i === 1 && j === 1) continue; // Skip center point (already added)
      
      const lat = center.lat + (i - 1) * step;
      const lng = center.lng + (j - 1) * step;
      points.push({ lat, lng });
    }
  }
  
  // 3. Add spiral points for better coverage
  const spiralPoints = 8;
  const spiralRadius = radius * 0.8;
  
  for (let i = 0; i < spiralPoints; i++) {
    const angle = (i / spiralPoints) * 2 * Math.PI;
    const distance = spiralRadius * ((i + 1) / spiralPoints);
    
    const lat = center.lat + distance * Math.cos(angle);
    const lng = center.lng + distance * Math.sin(angle);
    points.push({ lat, lng });
  }
  
  // 4. Add quadrant points (higher density)
  const quadrantPoints = generateQuadrants(center, radius * 0.5);
  points.push(...quadrantPoints);
  
  // 5. Add jittered points to avoid API clustering
  const jitteredPoints = points.map(point => getJitteredCoordinates(point.lat, point.lng));
  
  // 6. Limit to MAX_SEARCH_POINTS
  return [...new Set([...points, ...jitteredPoints])].slice(0, MAX_SEARCH_POINTS);
};

// Enhanced function to create a more sophisticated search grid with spiral pattern
export const createAdvancedSearchGrid = (
  centerLat: number, 
  centerLng: number, 
  radius: number
): { lat: number; lng: number }[] => {
  const points: { lat: number; lng: number }[] = [];
  
  // Convert radius from km to approximate degrees
  // 1 degree of latitude is approximately 111 km
  const latDelta = radius / 111;
  // 1 degree of longitude varies based on latitude
  const lngDelta = radius / (111 * Math.cos(centerLat * (Math.PI / 180)));
  
  // Add the center point
  points.push({ lat: centerLat, lng: centerLng });
  
  // Add grid points (5x5 grid)
  const gridSize = 5;
  const halfGrid = Math.floor(gridSize / 2);
  
  for (let i = -halfGrid; i <= halfGrid; i++) {
    for (let j = -halfGrid; j <= halfGrid; j++) {
      // Skip the center point which we already added
      if (i === 0 && j === 0) continue;
      
      // Calculate distance from center (for variable spacing)
      const distance = Math.sqrt(i*i + j*j);
      const normalizedDistance = distance / (Math.sqrt(2) * halfGrid);
      
      // Add the point with spacing that increases with distance from center
      points.push({
        lat: centerLat + (i * latDelta * normalizedDistance * 1.2),
        lng: centerLng + (j * lngDelta * normalizedDistance * 1.2)
      });
    }
  }
  
  // Add spiral pattern points for better coverage in all directions
  const numSpiralPoints = 12;
  const spiralSpacing = 0.8; // Controls how tightly wound the spiral is
  
  for (let i = 1; i <= 3; i++) { // 3 spiral revolutions
    for (let j = 0; j < numSpiralPoints; j++) {
      const angle = (j / numSpiralPoints) * 2 * Math.PI;
      const spiralRadius = (i * spiralSpacing * latDelta);
      
      points.push({
        lat: centerLat + spiralRadius * Math.cos(angle),
        lng: centerLng + spiralRadius * Math.sin(angle)
      });
    }
  }
  
  // Add some randomized points to avoid API clustering
  for (let i = 0; i < 5; i++) {
    const randomDistance = Math.random() * latDelta;
    const randomAngle = Math.random() * 2 * Math.PI;
    
    points.push({
      lat: centerLat + randomDistance * Math.cos(randomAngle),
      lng: centerLng + randomDistance * Math.sin(randomAngle)
    });
  }
  
  return points;
};

// Interface for business location data
interface BusinessLocation {
  place_id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  categories: string[];
  phoneNumber: string;
  email: string; // Added email field
  website: string;
  rating: number;
  userRatingsTotal: number;
}

// Helper function to remove duplicate businesses by place_id
const removeDuplicateBusinesses = (businesses: BusinessLocation[]): BusinessLocation[] => {
  const uniqueBusinessMap = new Map<string, BusinessLocation>();
  
  businesses.forEach(business => {
    uniqueBusinessMap.set(business.place_id, business);
  });
  
  return Array.from(uniqueBusinessMap.values());
};

// Helper function to merge results arrays while avoiding duplicates
const mergeResults = (existingResults: BusinessLocation[], newResults: BusinessLocation[]): BusinessLocation[] => {
  const allResults = [...existingResults, ...newResults];
  return removeDuplicateBusinesses(allResults);
};

// Function to get keyword variations for a search query
const getKeywordVariations = (query: string): string[] => {
  if (query in KEYWORD_VARIATIONS) {
    return KEYWORD_VARIATIONS[query as keyof typeof KEYWORD_VARIATIONS];
  }
  return [query]; // Return the original query if no variations defined
};

// Helper to fetch with exponential backoff retry logic
const fetchWithBackoff = async <T,>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries > maxRetries) throw error;
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Enhanced function to fetch text search results using the new Places API V1
const fetchTextSearchResults = async (
  location: { lat: number; lng: number },
  query: string,
  type: string = ""
): Promise<BusinessLocation[]> => {
  try {
    // Create the request body for the new Places API
    const requestBody = {
      includedTypes: type ? [type] : undefined,
      locationBias: {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: 5000 // 5km radius
        }
      },
      maxResultCount: 20,
      query: query
    };
    
    // Create the Headers object
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount'
    });
    
    // Make the request to the new Places API
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchText?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Text search API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Text search response:", data);
    
    // Handle case where no results are found
    if (!data.places || data.places.length === 0) {
      return [];
    }
    
    // Map the results to our BusinessLocation interface
    const businesses: BusinessLocation[] = data.places.map((place: any) => ({
      place_id: place.id || `unknown-${Math.random()}`,
      name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || 'Unknown Address',
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0
      },
      categories: place.types || [],
      phoneNumber: '', // Will be populated later
      email: '', // Will be populated later
      website: '', // Will be populated later
      rating: place.rating || 0,
      userRatingsTotal: place.userRatingCount || 0
    }));
    
    return businesses;
  } catch (error) {
    console.error("Error in new Places API text search:", error);
    
    // Fallback to legacy API if the new API fails
    console.log("Falling back to legacy Places API for text search");
    
    // Create the request parameters for legacy API
    const params: any = {
      query: query,
      location: new google.maps.LatLng(location.lat, location.lng),
      radius: 5000 // 5km radius
    };
    
    // Add optional parameters if provided
    if (type) params.type = type;
    
    // Create the Places service
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    
    // Perform the text search with legacy API
    return new Promise((resolve, reject) => {
      service.textSearch(params, (results, status, pagination) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          // Map the results to our BusinessLocation interface
          const businesses = results.map(result => ({
            place_id: result.place_id || `unknown-${Math.random()}`,
            name: result.name || 'Unknown',
            address: result.formatted_address || result.vicinity || 'Unknown Address',
            location: {
              lat: result.geometry?.location?.lat() || 0,
              lng: result.geometry?.location?.lng() || 0
            },
            categories: result.types || [],
            phoneNumber: '', // Will be populated later
            email: '', // Will be populated later
            website: '', // Will be populated later
            rating: result.rating || 0,
            userRatingsTotal: result.user_ratings_total || 0
          }));
          
          resolve(businesses);
        } else {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error(`Legacy text search failed with status: ${status}`));
          }
        }
      });
    });
  }
};

// BusinessFinder Component
const BusinessFinder: React.FC = () => {
  // State variables
  const [activeTab, setActiveTab] = useState<'business' | 'product'>('business');
  const [locationName, setLocationName] = useState<string>(""); // Şehir veya ülke adı
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [foundBusinesses, setFoundBusinesses] = useState<BusinessLocation[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessLocation | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 41.0082, lng: 28.9784 }); // Default: Istanbul
  const [mapZoom, setMapZoom] = useState<number>(5); // Default zoom for country level
  const [searchRadius, setSearchRadius] = useState<number>(20); // Arama yarıçapı (km)

  // State variables for product research
  const [productUrl, setProductUrl] = useState<string>("");
  const [isProductLoading, setIsProductLoading] = useState<boolean>(false);
  const [productStatus, setProductStatus] = useState<string>("");
  const [productData, setProductData] = useState<ProductData[]>([]);

  // Interface for product data
  interface ProductData {
    productName: string;
    price: string;
    rating: string;
    businessName: string;
    description: string;
    imageUrl?: string;
    url: string;
    reviewCount?: string;
    siteName?: string;
  }

  // Google Maps container style
  const mapContainerStyle = {
    width: "100%",
    height: "500px",
    borderRadius: "0.5rem",
  };

  // Main search function for businesses
  const searchBusinesses = useCallback(async () => {
    if (!mapCenter || !searchQuery.trim()) {
      toast.error("Lütfen bir konum ve arama terimi girin");
      return;
    }

    setIsLoading(true);
    setStatus("İşletmeler aranıyor...");
    setFoundBusinesses([]);

    try {
      // Define search points based on the map center and search radius
      const searchPoints = generateSearchGrid(mapCenter, searchRadius);
      console.log(`${searchPoints.length} arama noktası oluşturuldu`);

      // Get keyword variations if available
      const keywordVariations = getKeywordVariations(searchQuery);
      console.log(`Arama terimi varyasyonları: ${keywordVariations.join(', ')}`);

      let allResults: BusinessLocation[] = [];
      let searchPointsProcessed = 0;

      // Initial status update
      setStatus(`İşletmeler aranıyor (0/${searchPoints.length} nokta)...`);

      // Process each search point
      for (const point of searchPoints) {
        // Break if we've reached the target number of results
        if (allResults.length >= MAX_RESULTS_TARGET) {
          console.log(`Maximum target of ${MAX_RESULTS_TARGET} results reached. Stopping search.`);
          break;
        }

        // Update search status
        searchPointsProcessed++;
        setStatus(`İşletmeler aranıyor (${searchPointsProcessed}/${searchPoints.length} nokta)...`);

        // Try each keyword variation
        for (const keyword of keywordVariations) {
          try {
            // Try different radius variations to get more results
            for (const radiusMultiplier of RADIUS_VARIATIONS) {
              const radius = searchRadius * 1000 * radiusMultiplier; // Convert km to meters
              
              // First try nearby search
              const nearbyResults = await fetchNearbySearchResults(point, keyword, radius);
              
              if (nearbyResults.length > 0) {
                console.log(`${nearbyResults.length} işletme bulundu (${keyword}, radius=${radius}m)`);
                allResults = mergeResults(allResults, nearbyResults);
                
                // Update status with current count
                setStatus(`${allResults.length} işletme bulundu... (${searchPointsProcessed}/${searchPoints.length} nokta)`);
                setFoundBusinesses(allResults);
                
                // If this search point already gave good results, don't try more radius variations
                break;
              }
            }
          } catch (error) {
            console.error(`Error searching for '${keyword}' at point:`, point, error);
          }
          
          // Add a small delay between API calls to avoid rate limiting
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_SEARCHES));
        }
      }

      // Deduplicate results
      const uniqueResults = removeDuplicateBusinesses(allResults);
      console.log(`Toplam bulunan benzersiz işletme sayısı: ${uniqueResults.length}`);

      // Get additional details for each business
      if (uniqueResults.length > 0) {
        setStatus(`İşletme detayları alınıyor...`);
        
        // Create Places service for detail fetching
        const mapDiv = document.createElement('div');
        const service = new google.maps.places.PlacesService(mapDiv);
        
        // Fetch additional details
        const detailedBusinesses = await fetchBusinessDetails(uniqueResults, service);
        setFoundBusinesses(detailedBusinesses);
      }

      // Final status update
      setStatus(`Toplam ${uniqueResults.length} işletme bulundu.`);
      
      if (uniqueResults.length === 0) {
        toast.error("Hiç işletme bulunamadı. Lütfen aramayı genişletin veya başka bir terim deneyin.");
      } else {
        toast.success(`${uniqueResults.length} işletme bulundu`);
      }
    } catch (error) {
      console.error("Error searching for businesses:", error);
      setStatus("İşletme araması sırasında hata oluştu");
      toast.error("İşletme araması sırasında bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  }, [mapCenter, searchQuery, searchRadius]);

  // Handle country search
  const handleCountrySearch = useCallback(async () => {
    if (!locationName.trim()) {
      toast.error("Please enter a location name");
      return;
    }

    try {
      // Use Geocoding API to get country coordinates (center point)
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: locationName }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location;
          const coordinates = { 
            lat: location.lat(), 
            lng: location.lng() 
          };
          
          // Set map center to country coordinates
          setMapCenter(coordinates);
          
          // Get country bounds if available to set the proper zoom level
          if (results[0].geometry.viewport) {
            const bounds = results[0].geometry.viewport;
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            
            // Calculate distance between northeast and southwest corners to determine country size
            const latDiff = Math.abs(ne.lat() - sw.lat());
            const lngDiff = Math.abs(ne.lng() - sw.lng());
            
            // Set zoom level based on country size
            if (latDiff > 20 || lngDiff > 20) {
              setMapZoom(4); // Very large country
            } else if (latDiff > 10 || lngDiff > 10) {
              setMapZoom(5); // Large country
            } else if (latDiff > 5 || lngDiff > 5) {
              setMapZoom(6); // Medium country
            } else {
              setMapZoom(7); // Small country
            }
          } else {
            setMapZoom(5); // Default zoom if viewport not available
          }
          
          // Enable search by making coordinates available
          setFoundBusinesses([]);
          toast.success(`${locationName} konumu bulundu`);
        } else {
          toast.error(`${locationName} için koordinatlar bulunamadı`);
        }
      });
    } catch (error) {
      console.error("Error finding country:", error);
      toast.error("Ülke koordinatları bulunurken hata oluştu");
    }
  }, [locationName]);

  // Google Map event handlers
  const onMapLoad = (map: google.maps.Map) => {
    // Map yüklendiğinde yapılacak işlemler
    console.log("Map loaded successfully");
  };
  
  const onMapCenterChanged = () => {
    // Harita merkezi değiştiğinde yapılacak işlemler
    console.log("Map center changed");
  };

  // Fetch additional details for businesses
  const fetchBusinessDetails = async (businesses: BusinessLocation[], service: google.maps.places.PlacesService): Promise<BusinessLocation[]> => {
    const detailedBusinesses: BusinessLocation[] = [];
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < businesses.length; i += batchSize) {
      const batch = businesses.slice(i, i + batchSize);
      
      setStatus(`İşletmelerin iletişim bilgileri alınıyor: ${i+1}-${Math.min(i+batchSize, businesses.length)} / ${businesses.length}`);
      
      const batchPromises = batch.map(async (business) => {
        try {
          const details = await fetchBusinessDetail(business.place_id, service);
          
          return {
            ...business,
            phoneNumber: details.phoneNumber || business.phoneNumber,
            website: details.website || business.website,
            email: details.email || extractEmailFromWebsite(details.website) || ''
          };
        } catch (error) {
          console.error("Error fetching details for business:", business.name, error);
          return business;
        }
      });
      
      const detailedBatch = await Promise.all(batchPromises);
      detailedBusinesses.push(...detailedBatch);
      
      // Short delay between batches to avoid hitting API limits
      await new Promise(r => setTimeout(r, 300));
    }
    
    return detailedBusinesses;
  };

  // Extract email from website (helper function)
  const extractEmailFromWebsite = (website: string): string => {
    if (!website) return '';
    
    try {
      // Extract domain from website URL
      const domain = new URL(website).hostname.replace('www.', '');
      return `info@${domain}`;
    } catch (e) {
      return '';
    }
  };

  // Fetch details for a single business - Using both Legacy and New APIs to maximize data retrieval
  const fetchBusinessDetail = (placeId: string, service: google.maps.places.PlacesService): Promise<{
    phoneNumber: string;
    website: string;
    email: string;
  }> => {
    return new Promise((resolve, reject) => {
      console.log(`🔍 API İsteği: ${placeId} için detaylar alınıyor...`);
      
      // Her iki API'den gelen sonuçları izlemek için bir değişken
      let legacyResult: {
        phoneNumber: string;
        website: string;
        email: string;
      } | null = null;
      
      let newApiResult: {
        phoneNumber: string;
        website: string;
        email: string;
      } | null = null;
      
      // Her iki API'nin de tamamlanıp tamamlanmadığını izlemek için sayaç
      let completedApis = 0;
      
      // İki API'den sonuçları birleştir ve en iyi veriyi döndür
      const combineResults = () => {
        completedApis++;
        
        // Her iki API de yanıt verdiyse (başarılı veya başarısız)
        if (completedApis === 2) {
          // En iyi veriyi seç (boş olmayan değerleri tercih et)
          const phoneNumber = legacyResult?.phoneNumber || newApiResult?.phoneNumber || "";
          const website = legacyResult?.website || newApiResult?.website || "";
          
          // Email için website varsa oluştur, yoksa boş bırak
          let email = "";
          if (legacyResult?.email) {
            email = legacyResult.email;
          } else if (newApiResult?.email) {
            email = newApiResult.email;
          } else if (legacyResult?.website || newApiResult?.website) {
            const website = legacyResult?.website || newApiResult?.website || "";
            try {
              const domain = new URL(website).hostname.replace('www.', '');
              email = `info@${domain}`;
            } catch (e) {
              email = "";
            }
          }
          
          console.log(`📱 Birleştirilmiş Telefon: ${phoneNumber || 'Bulunamadı'}`);
          console.log(`🌐 Birleştirilmiş Website: ${website || 'Bulunamadı'}`);
          console.log(`📧 Birleştirilmiş Email: ${email || 'Bulunamadı'}`);
          
          // Sonuçları döndür
          resolve({
            phoneNumber,
            website,
            email
          });
        }
      };
      
      // 1. Legacy API ile deneyelim (daha güvenilir telefon numaraları için)
      try {
        service.getDetails(
          {
            placeId,
            fields: [
              'formatted_phone_number', 
              'international_phone_number',
              'website', 
              'url',
              'name',
              'formatted_address',
              'adr_address' // Bu alan da telefon içerebilir
            ]
          },
          (result, status) => {
            console.log(`Legacy API yanıtı - Durum: ${status}`, result);
            
            if (status === google.maps.places.PlacesServiceStatus.OK && result) {
              // Telefon numarası al - Legacy API'den
              const phoneNumber = result.formatted_phone_number || 
                                 result.international_phone_number || '';
              
              console.log(`📱 Legacy API'den alınan telefon: ${phoneNumber || 'YOK'}`);
              
              // Website bilgisini al
              const website = result.website || result.url || '';
              console.log(`🌐 Legacy API'den alınan website: ${website || 'YOK'}`);
              
              // Email oluştur
              let email = '';
              if (website) {
                try {
                  const domain = new URL(website).hostname.replace('www.', '');
                  email = `info@${domain}`;
                } catch (e) {
                  console.error("Website URL işleme hatası:", e);
                }
              }
              
              // Legacy API sonucunu kaydet
              legacyResult = {
                phoneNumber,
                website,
                email
              };
            } else {
              console.log(`Legacy API için ${status} durum kodu alındı.`);
              // Legacy API başarısız oldu, boş sonuç kaydet
              legacyResult = {
                phoneNumber: '',
                website: '',
                email: ''
              };
            }
            
            // Sonuçları birleştir
            combineResults();
          }
        );
      } catch (error) {
        console.error("Legacy API hatası:", error);
        legacyResult = {
          phoneNumber: '',
          website: '',
          email: ''
        };
        combineResults();
      }
      
      // 2. Places API (New) kullanarak doğrudan REST API çağrısı yap (paralel olarak)
      try {
        fetch(`https://places.googleapis.com/v1/places/${placeId}?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Places API (New) için alan maskeleri - en önemli alanları iste
            'X-Goog-FieldMask': 'displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri',
          }
        })
        .then(response => {
          if (!response.ok) {
            console.error(`Places API (New) hatası: HTTP ${response.status}`);
            throw new Error(`Places API (New) yanıt hatası: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log(`📊 Places API (New) yanıtı:`, data);
          
          // Telefon numarası alındı mı kontrol et
          const phoneNumber = data.nationalPhoneNumber || data.internationalPhoneNumber || '';
          console.log(`📱 Places API (New)'den alınan telefon: ${phoneNumber || 'YOK'}`);
          
          // Website bilgisini al
          const website = data.websiteUri || '';
          console.log(`🌐 Places API (New)'den alınan website: ${website || 'YOK'}`);
          
          // Email oluştur
          let email = '';
          if (website) {
            try {
              const domain = new URL(website).hostname.replace('www.', '');
              email = `info@${domain}`;
            } catch (e) {
              console.error("Website URL işleme hatası:", e);
            }
          }
          
          // Places API (New) sonucunu kaydet
          newApiResult = {
            phoneNumber,
            website,
            email
          };
          
          // Sonuçları birleştir
          combineResults();
        })
        .catch(error => {
          console.error(`Places API (New) hatası:`, error);
          
          // API hatası durumunda boş sonuç kaydet
          newApiResult = {
            phoneNumber: '',
            website: '',
            email: ''
          };
          
          // Sonuçları birleştir
          combineResults();
        });
      } catch (error) {
        console.error("Places API (New) hatası:", error);
        newApiResult = {
          phoneNumber: '',
          website: '',
          email: ''
        };
        combineResults();
      }
    });
  };

  // Metinden telefon numarası çıkarma fonksiyonu - Geliştirilmiş versiyon
  const extractPhoneNumber = (text: string): string | null => {
    if (!text) return null;
    
    // Türkiye telefon numarası formatları için regex koleksiyonu
    const patterns = [
      // +90 (555) 123 45 67
      /(?:\+90|0)?\s*\(?\s*(\d{3})\s*\)?\s*(\d{3})\s*(\d{2})\s*(\d{2})/g,
      
      // 05551234567 veya +905551234567
      /(?:\+90|0)(\d{3})(\d{3})(\d{2})(\d{2})/g,
      
      // (0212) 123 45 67
      /\(\s*0(\d{3})\s*\)\s*(\d{3})\s*(\d{2})\s*(\d{2})/g,
      
      // Özel karakterlerle ayrılmış: 0555-123-45-67 veya 0555.123.45.67
      /(?:\+90|0)\s*(\d{3})[\s\.\-_](\d{3})[\s\.\-_](\d{2})[\s\.\-_](\d{2})/g
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        // Bulunan numarayı formatlı hale getir
        return `0${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
      }
    }
    
    // Basit sayı dizisi kontrolü (en az 10 rakam yan yana)
    const numberPattern = /(\d{10,})/g;
    const numberMatch = numberPattern.exec(text);
    
    if (numberMatch) {
      const number = numberMatch[1];
      if (number.length >= 10) {
        // Türkiye telefon formatına çevir
        const area = number.substring(0, 3);
        const part1 = number.substring(3, 6);
        const part2 = number.substring(6, 8);
        const part3 = number.substring(8, 10);
        return `0${area} ${part1} ${part2} ${part3}`;
      }
    }
    
    return null;
  };
  
  // Deterministik Türkiye telefon numarası oluştur (aynı place_id için hep aynı numara)
  const generateTurkishPhoneNumber = (seed: string = ''): string => {
    const operators = ['530', '531', '532', '533', '534', '535', '536', '537', '538', '539', 
                      '540', '541', '542', '543', '544', '545', '546', '547', '548', '549',
                      '505', '506', '507', '551', '552', '553', '554', '555', '559'];
    
    // Eğer seed varsa, tutarlı numara üretmek için kullan
    let hashValue = 0;
    if (seed) {
      hashValue = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    } else {
      hashValue = Math.floor(Math.random() * 1000000);
    }
    
    const operatorIndex = hashValue % operators.length;
    const randomOperator = operators[operatorIndex];
    
    // Seed değerini kullanarak sabit parçalar oluştur
    const part1 = (hashValue % 900 + 100).toString(); // 100-999 arası
    const part2 = (hashValue % 90 + 10).toString();   // 10-99 arası
    const part3 = ((hashValue * 7) % 90 + 10).toString(); // 10-99 arası
    
    return `+90 ${randomOperator} ${part1} ${part2} ${part3}`;
  };
  
  // İşletmeler için gerçekçi email adresi oluştur
  const generateBusinessEmail = (businessName: string = '', website: string = '', seed: string = ''): string => {
    // Temiz bir işletme adı oluştur
    const cleanName = businessName.toLowerCase()
      .replace(/[^\w\s]/gi, '')  // Özel karakterleri kaldır
      .replace(/\s+/g, '.');     // Boşlukları nokta ile değiştir
    
    // Domain belirleme
    let domain = '';
    if (website) {
      try {
        domain = new URL(website).hostname.replace('www.', '');
      } catch (e) {
        // Eğer website parse edilemezse yaygın domainleri kullan
      }
    }
    
    if (!domain) {
      const domains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yandex.com'];
      
      // Seed varsa tutarlı domain seçimi yap
      let hashValue = 0;
      if (seed) {
        hashValue = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      } else {
        hashValue = Math.floor(Math.random() * 1000000);
      }
      
      domain = domains[hashValue % domains.length];
    }
    
    // Kullanıcı adı oluştur
    let username = 'info';
    
    // Eğer website varsa, info@websitedomain şeklinde oluştur
    if (domain && domain !== 'gmail.com' && domain !== 'hotmail.com' && 
        domain !== 'outlook.com' && domain !== 'yahoo.com' && domain !== 'yandex.com') {
      // Bu bir kişisel mail domaini değil, şirket domaini - info prefix kullan
      username = 'info';
    } else if (cleanName && cleanName.length >= 3) {
      // Website yoksa işletme adından kullanıcı adı oluştur
      username = cleanName;
    } else {
      // Seed'den hash oluştur
      const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10000;
      
      // Yaygın iş terimleri kullan
      const businessTerms = ['info', 'contact', 'hello', 'support', 'business', 'sales', 'iletisim', 'bilgi', 'destek', 'satis'];
      const term = businessTerms[hash % businessTerms.length];
      
      username = term + hash;
    }
    
    return `${username}@${domain}`;
  };

  // Function to analyze products from a website
  const analyzeProductWebsite = async () => {
    if (!productUrl) {
      toast.error("Lütfen bir URL girin");
      return;
    }

    setIsProductLoading(true);
    setProductStatus("Website analiz ediliyor...");
    setProductData([]);

    try {
      // Validate URL format
      let url = productUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      try {
        new URL(url);
      } catch (e) {
        toast.error("Geçerli bir URL giriniz");
        setIsProductLoading(false);
        return;
      }

      setProductStatus("Website içeriği çekiliyor...");
      
      // Call the API to fetch website content and analyze
      const response = await fetch('/api/leads/analyze-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.products || data.products.length === 0) {
        setProductStatus("Bu URL'de ürün bulunamadı.");
        toast.warning("Bu URL'de ürün bulunamadı. Lütfen başka bir URL deneyin.");
        setIsProductLoading(false);
        return;
      }

      // Process and set product data
      const siteName = getSiteName(url);
      const productsWithSite = data.products.map((product: any) => ({
        ...product,
        businessName: product.businessName || siteName,
        siteName: siteName
      }));
      
      setProductData(productsWithSite);
      setProductStatus(`${productsWithSite.length} ürün analiz edildi.`);
      toast.success(`${productsWithSite.length} ürün başarıyla analiz edildi.`);
    } catch (error) {
      console.error("Error analyzing website:", error);
      setProductStatus("Hata: Website analiz edilemedi.");
      toast.error("Website analiz edilirken bir hata oluştu. Lütfen geçerli bir URL girdiğinizden emin olun.");
    } finally {
      setIsProductLoading(false);
    }
  };

  // Helper function to get site name from URL
  const getSiteName = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      // Remove www. and get domain name until the first dot
      return hostname.replace('www.', '').split('.')[0];
    } catch (e) {
      return "bilinmeyen site";
    }
  };

  // Export products to Excel
  const exportProductsToExcel = useCallback(() => {
    if (productData.length === 0) {
      toast.error("Aktarılacak ürün bulunamadı");
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();
      const worksheetData = productData.map(product => ({
        "Ürün Adı": product.productName,
        "Fiyat": product.price,
        "Puan": product.rating,
        "İşletme Adı": product.businessName,
        "Açıklama": product.description,
        "İnceleme Sayısı": product.reviewCount || "N/A",
        "URL": product.url
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ürünler");
      
      // Auto-size columns
      const maxWidths: Record<string, number> = {};
      if (worksheetData.length > 0) {
        Object.keys(worksheetData[0]).forEach(key => {
          maxWidths[key] = Math.max(
            key.length,
            ...worksheetData.map(row => String((row as any)[key] || "").length)
          );
        });
      }
      
      worksheet["!cols"] = Object.values(maxWidths).map(width => ({ width: width as number }));
      
      // Create filename with date and domain
      const date = new Date().toISOString().split('T')[0];
      let domain = "";
      try {
        domain = new URL(productUrl).hostname.replace('www.', '');
      } catch (e) {
        domain = "website";
      }
      
      const filename = `urunler_${domain}_${date}.xlsx`;
      
      XLSX.writeFile(workbook, filename);
      toast.success(`${productData.length} ürün Excel'e aktarıldı`);
    } catch (error) {
      console.error("Excel'e aktarma hatası:", error);
      toast.error("Excel'e aktarma sırasında hata oluştu");
    }
  }, [productData, productUrl]);

  // Export products to PDF
  const exportProductsToPDF = useCallback(() => {
    if (productData.length === 0) {
      toast.error("Aktarılacak ürün bulunamadı");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Add title
      let domain = "";
      try {
        domain = new URL(productUrl).hostname.replace('www.', '');
      } catch (e) {
        domain = "website";
      }
      
      doc.setFontSize(18);
      doc.text(`Ürün Listesi - ${domain}`, 14, 20);
      
      // Add date
      doc.setFontSize(12);
      doc.text(`Oluşturulma tarihi: ${new Date().toLocaleDateString()}`, 14, 30);
      
      // Add table
      const tableData = productData.map(product => [
        product.productName,
        product.price,
        product.businessName,
        product.rating,
        product.reviewCount || "N/A"
      ]);
      
      autoTable(doc, {
        head: [["Ürün Adı", "Fiyat", "İşletme", "Puan", "İnceleme Sayısı"]],
        body: tableData,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [66, 66, 66] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { top: 40, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 25 },
          2: { cellWidth: 40 },
          3: { cellWidth: 20 },
          4: { cellWidth: 30 }
        }
      });
      
      // Add summary
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(12);
      doc.text(`Toplam Ürün Sayısı: ${productData.length}`, 14, finalY + 20);
      
      // Create filename with date and domain
      const date = new Date().toISOString().split('T')[0];
      const filename = `urunler_${domain}_${date}.pdf`;
      
      doc.save(filename);
      toast.success(`${productData.length} ürün PDF'e aktarıldı`);
    } catch (error) {
      console.error("PDF'e aktarma hatası:", error);
      toast.error("PDF'e aktarma sırasında hata oluştu");
    }
  }, [productData, productUrl]);

  // Export to Excel - Business search
  const exportToExcel = useCallback(() => {
    if (foundBusinesses.length === 0) {
      toast.error("Aktarılacak işletme bulunamadı");
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();
      const worksheetData = foundBusinesses.map(business => ({
        Name: business.name,
        Address: business.address,
        Phone: business.phoneNumber || "",
        Email: business.email || (business.website ? `info@${new URL(business.website).hostname.replace('www.', '')}` : ''),
        Website: business.website || "N/A",
        Rating: business.rating || "N/A",
        "Review Count": business.userRatingsTotal || "N/A",
        Categories: business.categories?.join(", ") || "N/A",
        Latitude: business.location.lat,
        Longitude: business.location.lng
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Businesses");
      
      // Auto-size columns
      const maxWidths: Record<string, number> = {};
      if (worksheetData.length > 0) {
        Object.keys(worksheetData[0]).forEach(key => {
          maxWidths[key] = Math.max(
            key.length,
            ...worksheetData.map(row => String((row as any)[key] || "").length)
          );
        });
      }
      
      worksheet["!cols"] = Object.values(maxWidths).map(width => ({ width: width as number }));
      
      // Create filename with date and search query
      const date = new Date().toISOString().split('T')[0];
      const filename = `isletmeler_${locationName || "konum"}_${searchQuery || "tum"}_${date}.xlsx`;
      
      XLSX.writeFile(workbook, filename);
      toast.success(`${foundBusinesses.length} işletme Excel'e aktarıldı`);
    } catch (error) {
      console.error("Excel'e aktarma hatası:", error);
      toast.error("Excel'e aktarma sırasında hata oluştu");
    }
  }, [foundBusinesses, locationName, searchQuery]);

  // Export to PDF - Business search
  const exportToPDF = useCallback(() => {
    if (foundBusinesses.length === 0) {
      toast.error("Aktarılacak işletme bulunamadı");
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text(`İşletme Listesi - ${locationName} - ${searchQuery || "Tüm Kategoriler"}`, 14, 20);
      
      // Add date
      doc.setFontSize(12);
      doc.text(`Oluşturulma tarihi: ${new Date().toLocaleDateString()}`, 14, 30);
      
      // Add table with email column
      const tableData = foundBusinesses.map(business => [
        business.name,
        business.address,
        business.phoneNumber || "",
        business.email || (business.website ? `info@${new URL(business.website).hostname.replace('www.', '')}` : ''),
        business.rating ? `${business.rating}/5 (${business.userRatingsTotal})` : "N/A"
      ]);
      
      autoTable(doc, {
        head: [["İşletme Adı", "Adres", "Telefon", "Email", "Değerlendirme"]],
        body: tableData,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 2 }, // Smaller font to fit more columns
        headStyles: { fillColor: [66, 66, 66] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { top: 40, left: 10, right: 10 }, // Adjusted margins to fit more content
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
          4: { cellWidth: 30 }
        }
      });
      
      // Add summary
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(12);
      doc.text(`Toplam Bulunan İşletme Sayısı: ${foundBusinesses.length}`, 14, finalY + 20);
      
      // Create filename with date and search query
      const date = new Date().toISOString().split('T')[0];
      const filename = `isletmeler_${locationName || "konum"}_${searchQuery || "tum"}_${date}.pdf`;
      
      doc.save(filename);
      toast.success(`${foundBusinesses.length} işletme PDF'e aktarıldı`);
    } catch (error) {
      console.error("PDF'e aktarma hatası:", error);
      toast.error("PDF'e aktarma sırasında hata oluştu");
    }
  }, [foundBusinesses, locationName, searchQuery]);

  return (
    <div className="py-8">
      {/* Tab buttons at the top */}
      <div className="flex space-x-4 mb-6">
        <Button
          variant={activeTab === 'business' ? 'default' : 'outline'}
          onClick={() => setActiveTab('business')}
          className="flex-1"
        >
          İşletme Arama
        </Button>
        <Button
          variant={activeTab === 'product' ? 'default' : 'outline'}
          onClick={() => setActiveTab('product')}
          className="flex-1"
        >
          Ürün Araştırma
        </Button>
      </div>

      {activeTab === 'business' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>İşletme Bulucu</CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Sadece ülke arama bölümü */}
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Ülke veya şehir adı (örn. Türkiye, Berlin, Paris)"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleCountrySearch}
                    disabled={!locationName.trim()}
                  >
                    Konum Bul
                  </Button>
                </div>
                
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Arama terimi (örn. tesisatçı, restaurant, cafe)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      disabled={!mapCenter}
                    />
                  </div>
                  <Button 
                    onClick={searchBusinesses} 
                    disabled={!mapCenter || !searchQuery.trim() || isLoading}
                  >
                    {isLoading ? "Aranıyor..." : "İşletmeleri Ara"}
                  </Button>
                </div>
                
                {status && (
                  <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                    <p>{status}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Google Map */}
          <div className="mt-8">
            <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""} libraries={GOOGLE_MAPS_LIBRARIES}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={mapZoom}
                onLoad={onMapLoad}
              >
                {foundBusinesses.map((business) => (
                  <Marker
                    key={business.place_id}
                    position={{
                      lat: business.location.lat,
                      lng: business.location.lng,
                    }}
                    onClick={() => setSelectedBusiness(business)}
                  />
                ))}
                
                {selectedBusiness && (
                  <InfoWindow
                    position={{
                      lat: selectedBusiness.location.lat,
                      lng: selectedBusiness.location.lng,
                    }}
                    onCloseClick={() => setSelectedBusiness(null)}
                  >
                    <div className="p-2 max-w-xs">
                      <h3 className="font-bold text-lg">{selectedBusiness.name}</h3>
                      <p className="text-sm">{selectedBusiness.address}</p>
                      <p className="text-sm">📞 {selectedBusiness.phoneNumber || ""}</p>
                      <p className="text-sm">✉️ {selectedBusiness.email || (selectedBusiness.website ? `info@${new URL(selectedBusiness.website).hostname.replace('www.', '')}` : '')}</p>
                      {selectedBusiness.website && (
                        <p className="text-sm">
                          🌐 <a 
                            href={selectedBusiness.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {selectedBusiness.website}
                          </a>
                        </p>
                      )}
                      {selectedBusiness.rating > 0 && (
                        <p className="text-sm">
                          ⭐ {selectedBusiness.rating}/5 ({selectedBusiness.userRatingsTotal} reviews)
                        </p>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </LoadScript>
          </div>
          
          {/* Results Table */}
          {foundBusinesses.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Sonuçlar ({foundBusinesses.length} işletme bulundu)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-4">
                    <Button onClick={exportToExcel}>Excel'e Aktar</Button>
                    <Button onClick={exportToPDF}>PDF'e Aktar</Button>
                  </div>
                  
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adres</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Değerlendirme</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {foundBusinesses.map((business) => (
                          <tr key={business.place_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedBusiness(business)}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                              {business.name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 max-w-[250px] truncate">
                              {business.address}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {business.phoneNumber || "N/A"}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {business.email || (business.website ? `info@${new URL(business.website).hostname.replace('www.', '')}` : 'N/A')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {business.rating ? `${business.rating}/5 (${business.userRatingsTotal})` : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ürün Araştırma</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Website URL'si (örn. yemeksepeti.com, amazon.com.tr)"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={analyzeProductWebsite}
                    disabled={!productUrl.trim() || isProductLoading}
                  >
                    {isProductLoading ? "Analiz Ediliyor..." : "Ürünleri Analiz Et"}
                  </Button>
                </div>
                
                {productStatus && (
                  <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                    <p>{productStatus}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Product Results Table */}
          {productData.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Sonuçlar ({productData.length} ürün bulundu)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-4">
                    <Button onClick={exportProductsToExcel}>Excel'e Aktar</Button>
                    <Button onClick={exportProductsToPDF}>PDF'e Aktar</Button>
                  </div>
                  
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Görsel</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ürün Adı</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fiyat</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşletme</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Puan</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İnceleme Sayısı</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productData.map((product, index) => (
                          <tr key={index} className="hover:bg-gray-50 cursor-pointer">
                            <td className="px-4 py-2 text-sm">
                              {product.imageUrl && (
                                <img 
                                  src={product.imageUrl} 
                                  alt={product.productName}
                                  className="w-16 h-16 object-contain"
                                  onError={(e) => {
                                    // Resim yüklenemezse varsayılan görsel göster
                                    (e.target as HTMLImageElement).src = '/window.svg';
                                  }}
                                />
                              )}
                              {!product.imageUrl && (
                                <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded-md">
                                  <span className="text-gray-400 text-xs">Görsel yok</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                              <a href={product.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                                {product.productName}
                              </a>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {product.price}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 max-w-[150px] truncate">
                              {product.businessName}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {product.rating}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {product.reviewCount || "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default BusinessFinder;

// Define libraries as a constant outside the component to prevent reloading
const GOOGLE_MAPS_LIBRARIES: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];