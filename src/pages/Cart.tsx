import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase";
import { toast } from "sonner";
import { formatCurrency } from '@/utils/formatCurrency';

interface WeightVariant {
  id: string;
  weight_value: number;
  weight_unit: string;
  price: number;
  original_price: number | null;
  sku: string | null;
  stock_quantity: number;
  is_available: boolean;
  is_default: boolean;
  display_order: number;
}

interface ProductLimits {
  slug: string;
  stock_quantity: number | null;
  min_order_quantity: number;
  max_order_quantity: number | null;
  hasVariants: boolean;
  variantData?: WeightVariant;
}

// CartItem component for individual cart items
const CartItem = ({ item, limits, onQuantityChange, onRemove }) => {
  const isOutOfStock = limits.stock === 0;
  const exceedsStock = item.quantity > limits.stock;

  return (
    <div className="flex gap-4">
      <div className="relative">
        <img
          src={item.image}
          alt={item.name}
          className={`w-24 h-24 object-cover rounded-lg ${isOutOfStock ? 'opacity-50' : ''}`}
        />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <span className="text-white text-xs font-semibold">Out of Stock</span>
          </div>
        )}
      </div>
      
      <div className="flex-1">
        <h3 className="font-semibold text-lg">{item.name}</h3>
        <p className="text-sm text-muted-foreground mb-2">{item.category}</p>
        <p className="text-lg font-bold text-primary">
          {formatCurrency(item.price * item.quantity)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatCurrency(item.price)} each
        </p>
        
        {/* Stock warnings */}
        {exceedsStock && !isOutOfStock && (
          <p className="text-xs text-destructive mt-1">
            Only {limits.stock} available in stock
          </p>
        )}
        {limits.stock > 0 && limits.stock <= 10 && !exceedsStock && (
          <p className="text-xs text-orange-500 mt-1">
            Only {limits.stock} left in stock
          </p>
        )}
        {limits.min > 1 && (
          <p className="text-xs text-muted-foreground mt-1">
            Min order: {limits.min}
          </p>
        )}
      </div>
      
      <div className="flex flex-col items-end justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-5 w-5 text-stone-800" />
        </Button>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              disabled={isOutOfStock}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-medium">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              disabled={isOutOfStock || item.quantity >= limits.max}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {item.quantity >= limits.max && limits.max < 999 && (
            <p className="text-xs text-muted-foreground">
              Max: {limits.max}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, total: subtotal } = useCart();
  const [productLimits, setProductLimits] = useState<Map<string, ProductLimits>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const deliveryCharge = subtotal > 500 ? 0 : 50;
  const total = subtotal + deliveryCharge;

  // Extract slug and variant ID from cart item ID
  const parseCartItemId = (itemId: string) => {
    // Format: "slug" or "slug-variantId"
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    const parts = itemId.split('-');
    const lastFive = parts.slice(-5).join('-'); // try to rebuild a UUID from the last 5 parts

    if (UUID_RE.test(lastFive)) {
      const slugPart = parts.slice(0, -5).join('-');
      return {
        slug: slugPart || null,
        variantId: lastFive,
      };
    }

    // If it's a pure UUID (legacy), still detect it
    if (UUID_RE.test(itemId)) {
      return { slug: null, variantId: itemId };
    }

    // Plain slug (no variant)
    return { slug: itemId, variantId: null };
  };

 useEffect(() => {
    const fetchProductLimits = async () => {
      if (items.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const itemsData = items.map(item => parseCartItemId(item.id));

        // Slugs we can fetch directly
        const uniqueSlugs = [...new Set(
          itemsData
            .map(d => d.slug)
            .filter((s): s is string => !!s)
        )];

        // Variant IDs that were added with UUID only (legacy carts)
        const uuidOnlyVariantIds = itemsData
          .filter(d => !d.slug && d.variantId)
          .map(d => d.variantId as string);

       

        const limitsMap = new Map<string, ProductLimits>();

        // 1) Fetch by slugs (covers "slug-only" and "slug-uuid" items)
        if (uniqueSlugs.length > 0) {
          const { data, error } = await supabase
            .from('products')
            .select(`
              slug, 
              stock_quantity, 
              min_order_quantity, 
              max_order_quantity,
              product_weight_variants (
                id,
                weight_value,
                weight_unit,
                price,
                original_price,
                sku,
                stock_quantity,
                is_available,
                is_default,
                display_order
              )
            `)
            .in('slug', uniqueSlugs);

          if (error) throw error;

          data?.forEach(product => {
            const hasVariants = product.product_weight_variants && product.product_weight_variants.length > 0;

            if (hasVariants) {
              product.product_weight_variants.forEach(variant => {
                const variantKey = `${product.slug}-${variant.id}`;
                const entry: ProductLimits = {
                  slug: product.slug,
                  stock_quantity: variant.stock_quantity,
                  min_order_quantity: product.min_order_quantity,
                  max_order_quantity: product.max_order_quantity,
                  hasVariants: true,
                  variantData: variant,
                };
                // Main key for new items
                limitsMap.set(variantKey, entry);
                // Alias for legacy carts that used UUID-only
                limitsMap.set(variant.id, entry);
              });
            } else {
              limitsMap.set(product.slug, {
                slug: product.slug,
                stock_quantity: product.stock_quantity,
                min_order_quantity: product.min_order_quantity,
                max_order_quantity: product.max_order_quantity,
                hasVariants: false,
              });
            }
          });
        }

        // 2) Fetch variant details for UUID-only items to get product slug and limits
        if (uuidOnlyVariantIds.length > 0) {
          const { data: variantRows, error: variantError } = await supabase
            .from('product_weight_variants')
            .select(`
              id,
              weight_value,
              weight_unit,
              price,
              original_price,
              sku,
              stock_quantity,
              is_available,
              is_default,
              display_order,
              products:product_id (
                slug,
                min_order_quantity,
                max_order_quantity
              )
            `)
            .in('id', uuidOnlyVariantIds);

          if (variantError) throw variantError;

          variantRows?.forEach(v => {
            const slug = v.products?.slug;
            if (!slug) return;

            const entry: ProductLimits = {
              slug,
              stock_quantity: v.stock_quantity,
              min_order_quantity: v.products?.min_order_quantity ?? 1,
              max_order_quantity: v.products?.max_order_quantity ?? null,
              hasVariants: true,
              variantData: {
                id: v.id,
                weight_value: v.weight_value,
                weight_unit: v.weight_unit,
                price: v.price,
                original_price: v.original_price,
                sku: v.sku,
                stock_quantity: v.stock_quantity,
                is_available: v.is_available,
                is_default: v.is_default,
                display_order: v.display_order,
              },
            };

            // Alias both keys so both legacy and new formats are supported
            limitsMap.set(`${slug}-${v.id}`, entry);
            limitsMap.set(v.id, entry);
          });
        }

     
        setProductLimits(limitsMap);
      } catch (error) {
        console.error('Error fetching product limits:', error);
        toast.error('Failed to load product information');
      } finally {
        setLoading(false);
      }
    };

    fetchProductLimits();
  }, [items]);


  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const limits = productLimits.get(itemId);
    

    if (!limits) {
      console.warn(`No limits found for ${itemId}, allowing change anyway`);
      updateQuantity(itemId, newQuantity);
      return;
    }

    const min = limits.min_order_quantity || 1;
    const stock = limits.stock_quantity ?? 0;
    const maxOrderQty = limits.max_order_quantity || 999;
    const max = Math.min(maxOrderQty, stock > 0 ? stock : 999);
    

    
    // Check minimum
    if (newQuantity < min) {
      if (newQuantity === 0) {
        // Allow removal via updateQuantity
        updateQuantity(itemId, 0);
      } else {
        toast.error(`Minimum order quantity is ${min}`);
      }
      return;
    }
    
    // Check stock first
    if (stock <= 0) {
      toast.error('This item is out of stock');
      return;
    }
    
    if (newQuantity > stock) {
      toast.error(`Only ${stock} items available in stock`);
      return;
    }
    
    // Check maximum
    if (newQuantity > max) {
      toast.error(`Maximum order quantity is ${max}`);
      return;
    }
    
    updateQuantity(itemId, newQuantity);
  };

  const getItemLimits = (itemId: string) => {
    const limits = productLimits.get(itemId);
    

    if (!limits) {
      return {
        min: 1,
        max: 999,
        stock: 0,
      };
    }

    const stock = limits.stock_quantity ?? 0;
    const maxOrderQty = limits.max_order_quantity || 999;
    
    return {
      min: limits.min_order_quantity || 1,
      max: Math.min(maxOrderQty, stock > 0 ? stock : 999),
      stock: stock,
    };
  };

  // Check if any items are out of stock or exceed available stock
  const hasStockIssues = items.some(item => {
    const limits = getItemLimits(item.id);
    const hasIssue = limits.stock === 0 || item.quantity > limits.stock;
    if (hasIssue) {

    }
    return hasIssue;
  });

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading cart...</p>
        </div>
      </PageContainer>
    );
  }

  if (items.length === 0) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <ShoppingCart className="mb-4 h-24 w-24 text-muted-foreground" />
          <h2 className="mb-2 text-2xl font-bold">Your cart is empty</h2>
          <p className="mb-6 text-muted-foreground">
            Add some delicious items to get started
          </p>
          <Button size="lg" onClick={() => navigate('/products')}>
            Browse Products
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>


      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="space-y-4">
            {items.map((item) => {
              const limits = getItemLimits(item.id);
              const isOutOfStock = limits.stock === 0;
              const exceedsStock = item.quantity > limits.stock;
              
              return (
                <div key={item.id}>
                  <div className={isOutOfStock || exceedsStock ? 'border-2 border-destructive rounded-lg p-4' : ''}>
                    <CartItem 
                      item={item}
                      limits={limits}
                      onQuantityChange={handleQuantityChange}
                      onRemove={removeItem}
                    />
                  </div>
                  <Separator className="mt-4" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="h-fit p-6">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span className="font-medium">
                {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
              </span>
            </div>
            {subtotal > 0 && subtotal < 500 && (
              <p className="text-xs text-muted-foreground">
                Add {formatCurrency(500 - subtotal)} more for free delivery
              </p>
            )}
          </div>

          <Separator className="my-4" />

          <div className="mb-4 flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {hasStockIssues && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Some items in your cart are out of stock or exceed available quantity. Please review your cart before checkout.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate('/checkout')}
              disabled={hasStockIssues}
            >
              Proceed to Checkout
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/products')}
            >
              Continue Shopping
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};

export default Cart;