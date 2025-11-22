import { Link} from "react-router-dom";
import { createPortal } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart, Plus, Star } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useState, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";


// ADD: dialog, label, radio group, supabase
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase";

// Updated Product interface to match database structure
export interface Product {
  id: string; // This should be the slug for routing
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  isNew?: boolean;
  rating?: number;
  review_count: number | null;
  description?: string;
  stock?: number;
  shortDescription?: string;
}

export type ProductCardProps =
  | { product: Product }
  | (Product & { onAddToCart?: () => void });

const ProductCard = (props: ProductCardProps) => {
  const { addItem } = useCart();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // ADD: local variant state
  type Variant = {
    id: string;
    weight_value: number;
    weight_unit: string;
    price: number;
    original_price?: number | null;
    stock_quantity?: number | null;
    is_available?: boolean | null;
    is_default?: boolean | null;
    display_order?: number | null;
  };

  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Support both new and legacy API
  const product: Product | undefined = (props as any).product ?? (props as any);

  if (!product || !product.id) {
    return null;
  }

  // ADD: fetch variants for a product by slug
  const fetchVariantsForProduct = async (slug: string): Promise<Variant[]> => {
    setVariantsLoading(true);
    try {
      const { data: prod, error: prodErr } = await supabase
        .from("products")
        .select("id")
        .eq("slug", slug)
        .single();
      if (prodErr) throw prodErr;
      if (!prod) return [];

      const { data: vars, error: varErr } = await supabase
        .from("product_weight_variants")
        .select(
          "id, weight_value, weight_unit, price, original_price, stock_quantity, is_available, is_default, display_order"
        )
        .eq("product_id", prod.id)
        .order("display_order", { ascending: true });

      if (varErr) throw varErr;

      const list = vars || [];
      setVariants(list);
      // Preselect default or first available
      const defId =
        list.find(v => v.is_default)?.id ??
        list.find(v => (v.is_available ?? true) && (v.stock_quantity ?? 1) > 0)?.id ??
        list[0]?.id ??
        null;
      setSelectedVariantId(defId);
      return list;
    } catch (e) {
      console.error("Failed to load variants", e);
      toast.error("Failed to load variants");
      setVariants([]);
      setSelectedVariantId(null);
      return [];
    } finally {
      setVariantsLoading(false);
    }
  };

  // CHANGED: make add to cart variant-aware
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isOutOfStock = product.stock !== undefined && product.stock === 0;
    if (isOutOfStock) {
      toast.error('This product is out of stock');
      return;
    }

    // Load variants by product slug (product.id is the slug)
    const list = await fetchVariantsForProduct(product.id);

    if (!list || list.length === 0) {
      // No variants: add direct
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
        quantity: 1,
      });
      toast.success(`${product.name} added to cart`);
      if ((props as any).onAddToCart) {
        (props as any).onAddToCart();
      }
      return;
    }

    // Has variants: open dialog
    setShowVariantDialog(true);
  };

  // ADD: confirm adding selected variant
  const confirmVariantAdd = () => {
    const v = variants.find(variant => variant.id === selectedVariantId);
    if (!v) {
      toast.error("Please select a variant");
      return;
    }
    if ((v.is_available === false) || ((v.stock_quantity ?? 1) <= 0)) {
      toast.error("Selected variant is not available");
      return;
    }

    addItem({
      id: `${product.id}-${v.id}`, // slug-variantId (works with downstream logic)
      name: `${product.name} - ${v.weight_value} ${v.weight_unit}`,
      price: v.price,
      image: product.image,
      category: product.category,
      quantity: 1,
    });

    toast.success(`${product.name} (${v.weight_value} ${v.weight_unit}) added to cart`);
    setShowVariantDialog(false);

    if ((props as any).onAddToCart) {
      (props as any).onAddToCart();
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  const isOutOfStock = product.stock !== undefined && product.stock === 0;
  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <>
      <Link to={`/products/${product.id}`} className="block">
        <div
          className="group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Full product image as background */}
          <div className="relative aspect-square">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
            
            {/* Dark overlay for better contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
            
            {/* Rating badge - top left with glass effect */}
            <div 
              className="absolute top-3 left-3 flex items-center gap-1 rounded-full px-3 py-1.5 border border-white/20"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-bold text-white">{product.rating || 4.8}</span>
            </div>
            
            {/* Wishlist button - top right with glass effect */}
            <Button
              variant="ghost"
              size="icon"
              className={`absolute right-3 top-3 h-9 w-9 rounded-full border border-white/20 p-0 hover:bg-white/20 transition-all ${
                isWishlisted ? 'text-red-500' : 'text-white'
              }`}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
              onClick={handleWishlist}
            >
              <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
            </Button>
            
            {/* Status badges with glass effect */}
            {(product.isNew || discount > 0 || isOutOfStock) && (
              <div className="absolute top-3 right-14 flex flex-col gap-2">
    
                {isOutOfStock && (
                  <Badge 
                    className="bg-red-500/80 text-white border-0"
                    style={{
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}
                  >
                    Out of Stock
                  </Badge>
                )}
              </div>
            )}
            
            {/* Bottom section with glass morphism - product name and price */}
            <div 
              className="absolute bottom-0 left-0 right-0 p-4 "
              style={{
                background: 'rgba(255, 255, 255, 0)'
              }}
            >
              <div className="flex items-end justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white line-clamp-1 mb-1">
                    {product.name}
                  </h3>
                  <span className="text-xl font-bold text-white">₹{product.price}</span>
                </div>
                
                <Button
                  size="sm"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="h-10 w-10 rounded-full p-0 border border-white/30 hover:bg-white/30 transition-all ml-3 flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 160, 60, 0.45), rgba(255, 90, 0, 0.35))',
                    backdropFilter: 'blur(25px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 8px 32px rgba(255, 120, 0, 0.4)',
                    borderRadius: '20px',
                  }}
                >
                  <Plus className="h-5 w-5 text-white" />
                </Button>
              </div>
            </div>
          </div>
        </div>           {/* closes: group container */}
      </Link>            {/* FIX: removed one extra </div> that was here */}

      {/* Variant selection dialog - remains outside the Link */}

{createPortal(
<Transition show={showVariantDialog} as={Fragment}>
  <Dialog
    as="div"
    className="relative z-[9999]"
    onClose={() => setShowVariantDialog(false)}
  >
    {/* Background overlay */}
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-200"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-150"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="fixed inset-0 bg-black/50" />
    </Transition.Child>

    {/* Bottom sheet container */}
    <div className="fixed inset-0 flex items-end justify-center">
      <Transition.Child
        as={Fragment}
        enter="transform transition ease-out duration-300"
        enterFrom="translate-y-full"
        enterTo="translate-y-0"
        leave="transform transition ease-in duration-200"
        leaveFrom="translate-y-0"
        leaveTo="translate-y-full"
      >
        <Dialog.Panel
          className="
            w-full max-w-lg 
            rounded-t-2xl 
            bg-white 
            shadow-lg 
            p-6 
            border-t 
          "
        >
          {/* Title */}
          <Dialog.Title className="text-lg font-semibold mb-4">
            Select a Variant
          </Dialog.Title>

          {/* Body Content */}
          {variantsLoading ? (
            <div className="py-4 text-sm text-muted-foreground">Loading variants...</div>
          ) : variants.length === 0 ? (
            <div className="py-4 text-sm text-muted-foreground">No variants available</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-medium mb-2">{product.name}</div>

              <RadioGroup
                value={selectedVariantId || ""}
                onValueChange={(value) => setSelectedVariantId(value)}
                className="space-y-3"
              >
                {variants.map((v) => {
                  const disabled =
                    v.is_available === false ||
                    (v.stock_quantity ?? 1) <= 0;

                  return (
                    <div
                      key={v.id}
                      className={`flex items-center space-x-3 rounded-lg border p-3 ${
                        disabled ? "opacity-50" : ""
                      }`}
                    >
                      <RadioGroupItem
                        value={v.id}
                        id={`v-${v.id}`}
                        disabled={disabled}
                      />

                      <div className="flex-1">
                        <Label
                          htmlFor={`v-${v.id}`}
                          className="cursor-pointer flex items-center justify-between w-full"
                        >
                          <span>
                            {v.weight_value} {v.weight_unit}
                          </span>
                          <span className="font-semibold">₹{v.price}</span>
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setShowVariantDialog(false)}
              className="flex-1 mr-2"
            >
              Cancel
            </Button>

            <Button
              className="flex-1 ml-2"
              onClick={confirmVariantAdd}
              disabled={!selectedVariantId || variantsLoading}
            >
              Add to Cart
            </Button>
          </div>
        </Dialog.Panel>
      </Transition.Child>
    </div>
  </Dialog>
</Transition>,
  document.getElementById("portal-root")!
)}
    </>
  );

};

export default ProductCard;