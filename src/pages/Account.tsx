import { useState, useEffect } from 'react';
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Package, User, MapPin, Home, Briefcase, Building, Plus, Loader2, Check, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase';
import AddressManager from "@/components/AddressManager"; 


interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  order_items: OrderItem[];
}

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

const Account = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);
  const [isDeletingAddress, setIsDeletingAddress] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
  });

  const [newAddress, setNewAddress] = useState({
    address_type: 'home' as 'home' | 'work' | 'other',
    street_address: '',
    city: '',
    state: '',
    pin_code: '',
    is_default: false
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    // Update profile data when user changes
    setProfileData({
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      email: user?.email || '',
      phone: profile?.phone || '',
    });

    // Fetch data from Supabase
    fetchOrders();
    fetchAddresses();
  }, [isAuthenticated, navigate, user]);

  const fetchOrders = async () => {
    if (!user?.id) return;

    setIsLoadingOrders(true);
    try {
      // Fetch orders with their items
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          status,
          total_amount,
          order_items (
            id,
            product_name,
            product_price,
            quantity,
            subtotal
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        toast.error('Failed to load orders');
        return;
      }

      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchAddresses = async () => {
    if (!user?.id) return;

    setIsLoadingAddresses(true);
    try {
      const { data: addressesData, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) {
        console.error('Error fetching addresses:', error);
        toast.error('Failed to load addresses');
        return;
      }

      setAddresses(addressesData || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Failed to load addresses');
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    setIsUpdating(true);

    try {
      console.log('Updating profile for user:', user.id);
      
      // Update the profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      console.log('Profile updated successfully');
      toast.success('Profile updated successfully');
      
      // Refresh user data if you have that method

      
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    setIsAddingAddress(true);

    try {
      // If this address is set as default, unset all other default addresses
      if (newAddress.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      // Insert the new address
      const { error } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          address_type: newAddress.address_type,
          street_address: newAddress.street_address,
          city: newAddress.city,
          state: newAddress.state,
          pin_code: newAddress.pin_code,
          is_default: newAddress.is_default,
        });

      if (error) {
        console.error('Error adding address:', error);
        throw error;
      }

      toast.success('Address added successfully');
      
      // Reset form
      setNewAddress({
        address_type: 'home',
        street_address: '',
        city: '',
        state: '',
        pin_code: '',
        is_default: false
      });
      
      // Refresh addresses
      fetchAddresses();
      
    } catch (error) {
      console.error('Error adding address:', error);
      toast.error('Failed to add address. Please try again.');
    } finally {
      setIsAddingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user?.id) return;

    setIsSettingDefault(addressId);

    try {
      // Start a transaction by first updating all addresses to not be default
      const { error: unsetError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      if (unsetError) {
        console.error('Error unsetting default address:', unsetError);
        throw unsetError;
      }

      // Then set the selected address as default
      const { error: setDefaultError } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (setDefaultError) {
        console.error('Error setting default address:', setDefaultError);
        throw setDefaultError;
      }

      toast.success('Default address updated successfully');
      
      // Refresh addresses
      fetchAddresses();
      
    } catch (error) {
      console.error('Error setting default address:', error);
      toast.error('Failed to update default address. Please try again.');
    } finally {
      setIsSettingDefault(null);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user?.id) return;

    // Check if this is the default address
    const addressToDelete = addresses.find(a => a.id === addressId);
    if (addressToDelete?.is_default) {
      toast.error('Cannot delete default address. Please set another address as default first.');
      return;
    }

    setIsDeletingAddress(addressId);

    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', addressId);

      if (error) {
        console.error('Error deleting address:', error);
        throw error;
      }

      toast.success('Address deleted successfully');
      
      // Refresh addresses
      fetchAddresses();
      
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Failed to delete address. Please try again.');
    } finally {
      setIsDeletingAddress(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'pending':
        return 'text-yellow-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getAddressIcon = (type: string) => {
    switch (type) {
      case 'home':
        return <Home className="h-4 w-4" />;
      case 'work':
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Building className="h-4 w-4" />;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {profile?.first_name}
            </h1>
            <p className="text-muted-foreground mt-1">Manage your account and orders</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="sm:inline">Addresses</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {isLoadingOrders ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground">Loading your orders...</p>
                </CardContent>
              </Card>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No orders yet</p>
                  <Button onClick={() => navigate('/products')}>Start Shopping</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <CardTitle className="text-lg">Order #{order.order_number}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Placed on {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium capitalize ${getStatusColor(order.status)}`}>
                            {order.status || 'pending'}
                          </p>
                          <p className="text-lg font-semibold mt-1">₹{order.total_amount}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>
                              {item.product_name} × {item.quantity}
                            </span>
                            <span>₹{item.subtotal}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) =>
                          setProfileData({ ...profileData, firstName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) =>
                          setProfileData({ ...profileData, lastName: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={profileData.email} 
                      disabled 
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, phone: e.target.value })
                      }
                    />
                  </div>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses" className="space-y-6">
             <AddressManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Account;