// src/components/Navbar.tsx
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShoppingCart, User, Menu, MapPin, ChevronDown, Home, Grid3x3, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from '@/lib/utils';
import logo from '../assets/logo.svg';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase';
import { toast } from 'sonner';

interface Address {
  id: string;
  user_id: string;
  address_type: 'home' | 'work' | 'other';
  street_address: string;
  city: string;
  state: string;
  pin_code: string;
  is_default: boolean;
  created_at: string;
}

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [updatingDefault, setUpdatingDefault] = useState<string | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { isAuthenticated, user } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { path: "/", label: "Home" },
    { path: "/products", label: "Products" },
  ];

  const bottomNavItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Grid3x3, label: 'Products', path: '/products' },
    { icon: ShoppingCart, label: 'Cart', path: '/cart', ...(itemCount > 0 && { badge: itemCount }) },
    { icon: User, label: 'Account', path: '/account' },
  ];

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!isAuthenticated || !user?.id) {
        setLoadingAddress(false);
        return;
      }

      try {
        const { data: addressesData, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });

        if (error) throw error;
        
        setAddresses(addressesData || []);
        
        const defaultAddress = addressesData?.find(a => a.is_default) || addressesData?.[0] || null;
        setSelectedAddress(defaultAddress);
      } catch (error) {
        console.error('Error fetching addresses:', error);
        toast.error('Failed to load addresses');
      } finally {
        setLoadingAddress(false);
      }
    };

    fetchAddresses();
  }, [isAuthenticated, user]);

  const handleAddressSelect = async (address: Address) => {
    if (!user?.id || address.id === selectedAddress?.id) return;
    
    if (address.is_default) {
      setSelectedAddress(address);
      return;
    }
    
    setUpdatingDefault(address.id);
    
    try {
      const { error: unsetError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      if (unsetError) throw unsetError;

      const { error: setDefaultError } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', address.id);

      if (setDefaultError) throw setDefaultError;

      setAddresses(prev => 
        prev.map(a => ({
          ...a,
          is_default: a.id === address.id
        }))
      );
      setSelectedAddress(address);
      
      toast.success('Default address updated');
    } catch (error) {
      console.error('Error updating default address:', error);
      toast.error('Failed to update default address');
    } finally {
      setUpdatingDefault(null);
    }
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center justify-between h-14 px-3 md:h-16 md:gap-4 md:px-4">
          {/* Logo on the left */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Logo" width={60} height={40} />
            <span className="hidden text-lg font-bold md:inline-block">
              Zaika <span className="text-accent">Toast</span>
            </span>
          </Link>

          {/* Right side items - Desktop and Mobile in same container */}
          <div className="flex items-center gap-2">
            {/* Address Selector - Desktop */}
            {isAuthenticated && (
              <div className="hidden md:block">
                {loadingAddress ? (
                  <div className="h-10 w-40 bg-gray-200 animate-pulse rounded-md"></div>
                ) : selectedAddress ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-auto gap-1 px-2 py-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground">Deliver to</p>
                          <p className="text-sm font-medium line-clamp-1">
                            {selectedAddress.city}, {selectedAddress.state}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {addresses.map((address) => (
                        <DropdownMenuItem
                          key={address.id}
                          onClick={() => handleAddressSelect(address)}
                          className="cursor-pointer"
                        >
                          <div className="flex-1">
                            <p className="font-medium capitalize">{address.address_type} Address</p>
                            <p className="text-xs text-muted-foreground">
                              {address.street_address}, {address.city}
                            </p>
                          </div>
                          {address.is_default && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Default
                            </Badge>
                          )}
                          {updatingDefault === address.id && (
                            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem onClick={() => navigate('/account')}>
                        <MapPin className="mr-2 h-4 w-4" />
                        Manage Addresses
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate('/account')}
                  >
                    <MapPin className="h-4 w-4" />
                    Add Address
                  </Button>
                )}
              </div>
            )}

            {/* Address Selector / Sign In - Mobile */}
            {isAuthenticated ? (
              <div className="md:hidden">
                {loadingAddress ? (
                  <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-md"></div>
                ) : selectedAddress ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 px-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <div className="text-left max-w-[120px]">
                          <p className="text-xs text-muted-foreground truncate">Deliver to</p>
                          <p className="text-sm font-medium truncate">
                            {selectedAddress.city}
                          </p>
                        </div>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      {addresses.map((address) => (
                        <DropdownMenuItem
                          key={address.id}
                          onClick={() => handleAddressSelect(address)}
                          className="cursor-pointer"
                        >
                          <div className="flex-1">
                            <p className="font-medium capitalize">{address.address_type} Address</p>
                            <p className="text-xs text-muted-foreground">
                              {address.street_address}, {address.city}
                            </p>
                          </div>
                          {address.is_default && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Default
                            </Badge>
                          )}
                          {updatingDefault === address.id && (
                            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem onClick={() => navigate('/account')}>
                        <MapPin className="mr-2 h-4 w-4" />
                        Manage Addresses
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate('/account')}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/auth')}
                className="gap-2 bg-stone-800"
              >
               
                <span className=" sm:inline">Sign In</span>
              </Button>
            )}

            {/* Cart and User icons - Desktop only */}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate('/cart')}
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-xs">
                    {itemCount}
                  </Badge>
                )}
              </Button>

              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/account')}
                >
                  <User className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="hidden md:flex"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation for Mobile - STICKY */}
      <nav className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full px-1 text-[10px] flex items-center justify-center"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Navbar;