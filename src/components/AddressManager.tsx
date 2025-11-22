import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Briefcase, Building, Plus, Loader2, Check, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase";
import { getAddressSuggestions, getPlaceDetails, OlaMapsPlace, extractAddressComponents } from "@/services/olaMapsService";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Address {
  id: string;
  user_id: string;
  address_type: "home" | "work" | "other";
  street_address: string;
  city: string;
  state: string;
  pin_code: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  created_at: string;
  house_number: string;
  label: string;
  landmark: string;
  country: string;
}

const AddressManager = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(
    null
  );
  const [isDeletingAddress, setIsDeletingAddress] = useState<string | null>(
    null
  );

  const [suggestions, setSuggestions] = useState<OlaMapsPlace[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [newAddress, setNewAddress] = useState({
    address_type: "home" as "home" | "work" | "other",
    formatted_address: "",
    street_address: "",
    city: "",
    state: "",
    pin_code: "",
    latitude: null as number | null,
    longitude: null as number | null,
    is_default: false,
    label: "",
    landmark: "",
    house_number: "",
    country: "India",
  });

  const [inputMode, setInputMode] = useState<"auto" | "manual">("manual");
  const [stage, setStage] = useState<"select" | "details">("select");
  const [previewPosition, setPreviewPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, [user]);

  const fetchAddresses = async () => {
    if (!user?.id) return;
    setIsLoadingAddresses(true);
    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      setAddresses(data || []);
    } catch (err) {
      toast.error("Failed to load addresses");
      console.error(err);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewAddress({ ...newAddress, formatted_address: val });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      const results = await getAddressSuggestions(val);
      setSuggestions(results);
      if (results.length > 0) setPreviewPosition([results[0].latitude, results[0].longitude]);
      setShowSuggestions(true);
      setIsLoadingSuggestions(false);
    }, 400);
  };

  const handleSelectSuggestion = async (place: OlaMapsPlace) => {
    setIsLoadingSuggestions(true);
    try {
      // Get detailed address information
      const details = await getPlaceDetails(place.latitude, place.longitude);
      if (details) {
        const addressComp = extractAddressComponents(
          details.result.address_components
        );
        setNewAddress({
          ...newAddress,
          formatted_address:
            details.result.formatted_address || place.address,
          street_address:
            place.name ||
            addressComp.street ||
            details.result.formatted_address.split(",")[0],
          city: addressComp.city,
          state: addressComp.state,
          pin_code: addressComp.pinCode,
          latitude: place.latitude,
          longitude: place.longitude,
          is_default: false,
        });
        setStage("details");
      } else {
        // Fallback if details fetch fails
        setNewAddress({
          ...newAddress,
          formatted_address: place.address,
          street_address: place.name,
          city: "",
          state: "",
          pin_code: "",
          latitude: place.latitude,
          longitude: place.longitude,
          is_default: false,
        });
        setStage("details");
      }
    } catch (err) {
      toast.error("Failed to get address details");
      console.error(err);
    } finally {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setNewAddress((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    updateAddressFromCoordinates(lat, lng);
  };

const handleUseCurrentLocation = () => {
  if (!navigator.geolocation) return toast.error("Geolocation not supported");
  toast('Requesting location permission...');
  
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      // Set preview position for the map
      setPreviewPosition([lat, lng]);
      
      // Just get the location and update the form, don't save it
      setInputMode("auto");
      setNewAddress((prev) => ({ 
        ...prev, 
        latitude: lat, 
        longitude: lng 
      }));
      
      // Get address details from coordinates
      await updateAddressFromCoordinates(lat, lng);
      
      // Move to details stage for user to review and confirm
      setStage("details");
      toast.success("Location detected — please review and confirm details before saving");
    },
    (err) => {
      console.error(err);
      toast.error("Unable to get location. Please allow location access or use manual mode.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

  // Small helper component to register map click events
  const MapClickHandler = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
    useMapEvents({
      click(e) {
        onClick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const updateAddressFromCoordinates = async (
    lat: number,
    lng: number
  ) => {
    try {
      setIsLoadingSuggestions(true);
      const details = await getPlaceDetails(lat, lng);
      if (details) {
        const addressComp = extractAddressComponents(
          details.result.address_components
        );
        setNewAddress((prev) => ({
          ...prev,
          formatted_address: details.result.formatted_address,
          street_address:
            details.result.name ||
            addressComp.street ||
            details.result.formatted_address.split(",")[0],
          city: addressComp.city,
          state: addressComp.state,
          pin_code: addressComp.pinCode,
        }));
      }
    } catch (err) {
      console.error("Error updating address:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return toast.error("User not found");
    if (
      !newAddress.street_address ||
      !newAddress.latitude ||
      !newAddress.longitude
    )
      return toast.error("Please select a valid address from the map");

    setIsAddingAddress(true);
    try {
      if (newAddress.is_default) {
        await supabase
          .from("addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }
      const { error } = await supabase
        .from("addresses")
        .insert({ ...newAddress, user_id: user.id });
      if (error) throw error;
      toast.success("Address added successfully!");
      setNewAddress({
        address_type: "home",
        formatted_address: "",
        street_address: "",
        city: "",
        state: "",
        pin_code: "",
        latitude: null,
        longitude: null,
        is_default: false,
        label: "",
        landmark: "",
        house_number: "",
        country: "India",
      });
      setStage("select");
      fetchAddresses();
    } catch (err) {
      toast.error("Failed to add address");
      console.error(err);
    } finally {
      setIsAddingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    if (!user?.id) return;
    setIsSettingDefault(id);
    try {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
      const { error } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", id);
      if (error) throw error;
      toast.success("Default address updated");
      fetchAddresses();
    } catch (err) {
      toast.error("Failed");
      console.error(err);
    } finally {
      setIsSettingDefault(null);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const addr = addresses.find((a) => a.id === id);
    if (addr?.is_default)
      return toast.error("Cannot delete default address");
    setIsDeletingAddress(id);
    try {
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Address deleted!");
      fetchAddresses();
    } catch (err) {
      toast.error("Failed to delete address");
      console.error(err);
    } finally {
      setIsDeletingAddress(null);
    }
  };

  const getAddressIcon = (type: string) => {
    switch (type) {
      case "home":
        return <Home className="h-4 w-4" />;
      case "work":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Building className="h-4 w-4" />;
    }
  };

  // Check if all required fields are filled
  const isFormValid = () => {
    return (
      newAddress.house_number &&
      newAddress.label &&
      newAddress.street_address &&
      newAddress.city &&
      newAddress.state &&
      newAddress.pin_code &&
      newAddress.latitude !== null &&
      newAddress.longitude !== null
    );
  };

  // Function to format the complete address for display
  const formatCompleteAddress = (addr: Address) => {
    const parts = [];
    
    if (addr.house_number) parts.push(addr.house_number);
    if (addr.label) parts.push(addr.label);
    if (addr.street_address) parts.push(addr.street_address);
    if (addr.landmark) parts.push(`Landmark: ${addr.landmark}`);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.pin_code) parts.push(addr.pin_code);
    if (addr.country && addr.country !== "India") parts.push(addr.country);
    
    return parts.join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Saved Addresses */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Your Addresses</CardTitle>
             <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  document
                    .getElementById("add-address-form")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
          </div>
        </CardHeader>
        <CardContent>
           {isLoadingAddresses ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No addresses yet</p>
                <Button
                  onClick={() =>
                    document
                      .getElementById("add-address-form")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Add Address
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {addresses.map((addr) => (
              <div key={addr.id} className="border rounded-lg p-4 hover:bg-accent/5 transition">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1 text-muted-foreground">{getAddressIcon(addr.address_type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium capitalize">
                          {addr.address_type} Address
                        </p>
                        {addr.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        {addr.house_number && (
                          <p className="text-sm">
                            <span className="font-medium">Flat/House No.:</span> {addr.house_number}
                          </p>
                        )}
                        {addr.label && (
                          <p className="text-sm">
                            <span className="font-medium">Building/Apartment:</span> {addr.label}
                          </p>
                        )}
                        {addr.street_address && (
                          <p className="text-sm">
                            <span className="font-medium">Street:</span> {addr.street_address}
                          </p>
                        )}
                        {addr.landmark && (
                          <p className="text-sm">
                            <span className="font-medium">Landmark:</span> {addr.landmark}
                          </p>
                        )}
                        <p className="text-sm">
                          <span className="font-medium">City:</span> {addr.city}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">State:</span> {addr.state}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">PIN Code:</span> {addr.pin_code}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!addr.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleSetDefaultAddress(addr.id)
                        }
                        disabled={isSettingDefault === addr.id}
                      >
                        {isSettingDefault === addr.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline ml-2">
                          Set Default
                        </span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDeleteAddress(addr.id)
                      }
                      disabled={
                        isDeletingAddress === addr.id ||
                        addr.is_default
                      }
                    >
                      {isDeletingAddress === addr.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline ml-2">
                        Delete
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Address Form */}
      <Card id="add-address-form">
         <CardHeader>
           <CardTitle>Add New Address</CardTitle>
         </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAddress} className="space-y-4">
            {/* Map preview above search - always visible in selection stage */}
            {stage === "select" && (
              <div className="h-48 w-full rounded-lg overflow-hidden border">
                <MapContainer
                  center={
                    previewPosition
                      ? previewPosition
                      : newAddress.latitude && newAddress.longitude
                      ? [newAddress.latitude, newAddress.longitude]
                      : [20.5937, 78.9629]
                  }
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <MapClickHandler onClick={(lat, lng) => {
                    setPreviewPosition([lat, lng]);
                    setNewAddress((p) => ({ ...p, latitude: lat, longitude: lng }));
                  }} />
                  <TileLayer
                    attribution={import.meta.env.VITE_OLA_MAPS_ATTRIBUTION || '&copy; OpenStreetMap contributors'}
                    url={import.meta.env.VITE_OLA_MAPS_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
                  />
                  {previewPosition && (
                    <Marker position={previewPosition} />
                  )}
                </MapContainer>
              </div>
            )}

            <div className="space-y-2 relative">
              <Label htmlFor="search">Search Address</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  id="search"
                  value={newAddress.formatted_address}
                  onChange={handleSearchChange}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Start typing your address..."
                  className="pl-10"
                  autoComplete="off"
                />
                {isLoadingSuggestions && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border rounded-md max-h-60 overflow-y-auto mt-1 shadow-lg">
                  {suggestions.map((place) => (
                    <li
                      key={place.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex gap-2 transition"
                      onClick={() => { setPreviewPosition([place.latitude, place.longitude]); handleSelectSuggestion(place); }}
                    >
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">{place.name}</p>
                        <p className="text-xs text-gray-500">{place.address}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Compact controls: Use My Location button and toggle for manual if needed */}
            <div className="flex gap-2 items-center mt-2">
              <Button 
                type="button" 
                size="sm"
                onClick={handleUseCurrentLocation}
              >
                Use My Location
              </Button>
   
            </div>

            {/* Show bigger interactive map in details stage for fine-tuning */}
            {stage === "details" && newAddress.latitude && newAddress.longitude && (
              <div className="space-y-2">
                <Label>Adjust Location</Label>
                <div className="h-72 w-full rounded-lg overflow-hidden border">
                  <MapContainer
                    center={[newAddress.latitude, newAddress.longitude]}
                    zoom={16}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <MapClickHandler onClick={handleMapClick} />
                    <TileLayer
                      attribution={import.meta.env.VITE_OLA_MAPS_ATTRIBUTION || '&copy; OpenStreetMap contributors'}
                      url={import.meta.env.VITE_OLA_MAPS_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
                    />
                    <Marker
                      position={[newAddress.latitude, newAddress.longitude]}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e: any) => {
                          const marker = e.target;
                          const pos = marker.getLatLng();
                          handleMapClick(pos.lat, pos.lng);
                        },
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-medium">{newAddress.formatted_address || "Selected Location"}</p>
                          <p className="text-xs text-muted-foreground">Drag the pin to fine-tune</p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <p className="text-xs text-muted-foreground">💡 Tip: Drag the marker or click on the map to move the pin</p>
              </div>
            )}

            {/* Details stage: show when a location is chosen */}
            {stage === "details" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Flat / House No.</Label>
                    <Input
                      value={newAddress.house_number}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, house_number: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Building / Apartment</Label>
                    <Input
                      value={newAddress.label}
                      onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Landmark</Label>
                    <Input
                      value={newAddress.landmark}
                      onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label>City</Label>
                    <Input value={newAddress.city} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={newAddress.state} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>PIN Code</Label>
                    <Input value={newAddress.pin_code} readOnly className="bg-muted" />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
               <input
                 type="checkbox"
                 checked={newAddress.is_default}
                 onChange={(e) =>
                   setNewAddress({
                     ...newAddress,
                     is_default: e.target.checked,
                   })
                 }
                 className="rounded border-gray-300"
               />
              <Label>Set as default address</Label>
            </div>

            <Button 
              type="submit" 
              disabled={!isFormValid() || isAddingAddress} 
              className="w-full sm:w-auto"
              variant={!isFormValid() ? "secondary" : "default"}
            >
               {isAddingAddress ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Adding...
                 </>
               ) : (
                 "Add Address"
               )}
            </Button>
            {!isFormValid() && (
              <p className="text-xs text-muted-foreground mt-2">
                Please complete all required fields (select a location from the map)
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressManager;