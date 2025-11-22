import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useMemo, 
  useCallback 
} from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase';

export interface CartItem {
  id: string; 
  name: string;
  price: number;
  image: string;
  category: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  total: number;
  itemCount: number;
  processOrder: (orderId: string) => Promise<boolean>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {
      setItems([]);
    }
  }, []);

  // Save to localStorage only when items change
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);


  // --------------------------
  //  CART ITEM OPERATIONS
  // --------------------------

  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qty = item.quantity ?? 1;

    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });

    toast.success(`${item.name} added to cart`);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Item removed from cart");
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) return removeItem(id);

    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity } : item))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem("cart");
    toast.success("Cart cleared");
  }, []);


  // --------------------------
  //  MEMOIZED TOTALS
  // --------------------------

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );


  const getTotalItems = useCallback(() => itemCount, [itemCount]);
  const getTotalPrice = useCallback(() => total, [total]);


  // --------------------------
  //  PROCESS ORDER (RPC)
  // --------------------------

  const processOrder = useCallback(async () => {
    try {
      const orderItems = items.map(item => ({
        product_slug: item.id,
        quantity: item.quantity,
      }));

      // Call RPC
      const { data, error } = await supabase.rpc("process_order_stock_update", {
        order_items: orderItems,
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Stock update failed");
        return false;
      }

      return true;
    } catch (err) {
      toast.error("Failed to process order");
      return false;
    }
  }, [items]);


  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
        total,
        itemCount,
        processOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
