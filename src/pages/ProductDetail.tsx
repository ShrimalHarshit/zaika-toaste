import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, ShoppingCart, ArrowLeft, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase";
import { toast } from "sonner";
import { RadioGroup } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";


interface Ingredient {
  id: string;
  name: string;
  is_allergen: boolean;
}

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

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  description: string | null;
  image_url: string | null;
  is_new: boolean;
  is_featured: boolean;
  is_available: boolean;
  rating: number | null;
  review_count: number | null;
  category_id: string | null;
  stock_quantity: number;
  min_order_quantity: number;
  max_order_quantity: number | null;
  categories?: { name: string; slug: string };
  product_images?: { image_url: string; is_primary: boolean; display_order: number }[];
  product_ingredients?: { ingredients: Ingredient }[];
  product_weight_variants?: WeightVariant[];
}

const ProductDetail = () => {
  const { id: slug } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<WeightVariant | null>(null);
  const { addItem } = useCart();

  // Fetch product by slug
  const fetchProduct = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (name, slug),
          product_images (image_url, is_primary, display_order),
          product_ingredients (
            ingredients (id, name, is_allergen)
          ),
          product_weight_variants (*)
        `)
        .eq('slug', slug)
        .eq('is_available', true)
        .single();

      if (error) throw error;
      setProduct(data);

      // Set default weight variant if available
      if (data?.product_weight_variants && data.product_weight_variants.length > 0) {
        const sortedVariants = [...data.product_weight_variants].sort(
          (a, b) => a.display_order - b.display_order
        );
        const defaultVariant = sortedVariants.find(v => v.is_default) || sortedVariants[0];
        setSelectedVariant(defaultVariant);
      }

      // Set initial quantity to min_order_quantity
      if (data?.min_order_quantity) {
        setQuantity(data.min_order_quantity);
      }

      // Fetch related products
      if (data?.category_id) {
        const { data: related, error: relatedError } = await supabase
          .from('products')
          .select(`
            *,
            categories (name, slug),
            product_images (image_url, is_primary, display_order)
          `)
          .eq('category_id', data.category_id)
          .eq('is_available', true)
          .neq('id', data.id)
          .limit(4);

        if (!relatedError && related) {
          setRelatedProducts(related);
        }
      }
    } catch (error: any) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  // Get primary image or first image
  const getProductImage = (prod: Product) => {
    if (prod.image_url) return prod.image_url;
    
    if (prod.product_images && prod.product_images.length > 0) {
      const sortedImages = [...prod.product_images].sort((a, b) => a.display_order - b.display_order);
      const primaryImage = sortedImages.find(img => img.is_primary);
      if (primaryImage) return primaryImage.image_url;
      return sortedImages[0].image_url;
    }
    
    return 'https://via.placeholder.com/400';
  };

  // Get all product images
  const getAllProductImages = () => {
    if (!product) return [];
    
    const images: string[] = [];
    
    if (product.image_url) {
      images.push(product.image_url);
    }
    
    if (product.product_images && product.product_images.length > 0) {
      const sortedImages = [...product.product_images].sort((a, b) => a.display_order - b.display_order);
      sortedImages.forEach(img => {
        if (!images.includes(img.image_url)) {
          images.push(img.image_url);
        }
      });
    }
    
    return images.length > 0 ? images : ['https://via.placeholder.com/400'];
  };

  // Get current price based on variant or product
  const getCurrentPrice = () => {
    if (selectedVariant) {
      return selectedVariant.price;
    }
    return product?.price || 0;
  };

  // Get current original price
  const getCurrentOriginalPrice = () => {
    if (selectedVariant) {
      return selectedVariant.original_price;
    }
    return product?.original_price;
  };

  // Get current stock
  const getCurrentStock = () => {
    if (selectedVariant) {
      return selectedVariant.stock_quantity;
    }
    return product?.stock_quantity || 0;
  };

  // Check if product is in stock
  const isInStock = () => {
    const stock = getCurrentStock();
    if (selectedVariant) {
      return selectedVariant.is_available && stock > 0;
    }
    return product?.is_available && stock > 0;
  };

const handleAddToCart = () => {
    if (!product) return;
    
    const stock = getCurrentStock();
    
    // Check stock
    if (stock < quantity) {
      toast.error('Not enough stock available');
      return;
    }

    const variantLabel = selectedVariant 
      ? `${selectedVariant.weight_value}${selectedVariant.weight_unit}`
      : '';

    addItem({
      // CHANGED: ensure variant items use "slug-uuid" so Cart can parse and fetch stock correctly
      id: selectedVariant ? `${product.slug}-${selectedVariant.id}` : product.slug,
      name: `${product.name}${variantLabel ? ` (${variantLabel})` : ''}`,
      price: getCurrentPrice(),
      image: getProductImage(product),
      category: product.categories?.name || 'Uncategorized',
      quantity: quantity,
    });

    toast.success(`Added ${quantity} ${product.name} to cart`);
    setQuantity(product.min_order_quantity);
  };


  const handleQuantityChange = (newQuantity: number) => {
    const min = product?.min_order_quantity || 1;
    const stock = getCurrentStock();
    const max = product?.max_order_quantity || stock || 999;
    
    if (newQuantity < min) {
      setQuantity(min);
      return;
    }
    
    if (newQuantity > max) {
      toast.error(`Maximum order quantity is ${max}`);
      setQuantity(max);
      return;
    }
    
    if (newQuantity > stock) {
      toast.error(`Only ${stock} available in stock`);
      setQuantity(stock);
      return;
    }
    
    setQuantity(newQuantity);
  };

  const handleVariantChange = (variantId: string) => {
    const variant = product?.product_weight_variants?.find(v => v.id === variantId);
    if (variant) {
      setSelectedVariant(variant);
      // Reset quantity to min order quantity
      setQuantity(product?.min_order_quantity || 1);
    }
  };

  // Format weight display
  const formatWeight = (variant: WeightVariant) => {
    return `${variant.weight_value}${variant.weight_unit}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The product you're looking for doesn't exist or is no longer available.
          </p>
          
        </div>
      </div>
    );
  }

  const productImages = getAllProductImages();
  const ingredients = product.product_ingredients?.map(pi => pi.ingredients) || [];
  const hasWeightVariants = product.product_weight_variants && product.product_weight_variants.length > 0;
  const currentStock = getCurrentStock();

  return (
    <div className="container mx-auto px-4 py-6">


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden">
            <img
              src={productImages[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {product.is_new && (
              <Badge className="absolute top-4 right-4 bg-accent">New</Badge>
            )}
            {product.is_featured && (
              <Badge className="absolute top-4 left-4 bg-yellow-500">Featured</Badge>
            )}
            {!isInStock() && (
              <Badge className="absolute top-4 left-4 bg-destructive">Out of Stock</Badge>
            )}
          </div>

          {/* Thumbnail Images */}
          {productImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {productImages.slice(1, 5).map((img, idx) => (
                <div key={idx} className="aspect-square rounded-md overflow-hidden border">
                  <img
                    src={img}
                    alt={`${product.name} ${idx + 2}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground uppercase mb-2">
              {product.categories?.name || 'Uncategorized'}
            </p>
            <h1 className="text-4xl font-display font-bold mb-4">{product.name}</h1>
            
            <div className="flex items-center gap-4 mb-2">
              <p className="text-3xl font-bold text-primary">₹{getCurrentPrice()}</p>
              {getCurrentOriginalPrice() && getCurrentOriginalPrice()! > getCurrentPrice() && (
                <p className="text-xl text-muted-foreground line-through">
                  ₹{getCurrentOriginalPrice()}
                </p>
              )}
            </div>

            {product.rating && product.rating > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < Math.round(product.rating!) ? "text-yellow-400" : "text-gray-300"}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product.review_count || 0} reviews)
                </span>
              </div>
            )}

            {currentStock <= 10 && currentStock > 0 && (
              <p className="text-sm text-orange-500 mt-2">
                Only {currentStock} left in stock!
              </p>
            )}
          </div>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          )}


{hasWeightVariants && (
  <div className="space-y-2">
    <label className="font-semibold text-sm">Select Weight/Size:</label>

    <RadioGroup
      value={selectedVariant?.id || ""}
      onChange={(value: string) => {
        // value is variant.id
        handleVariantChange(value);
      }}
      className="grid grid-cols-3 gap-3"
      aria-label="Weight variants"
    >
      {product.product_weight_variants
        ?.sort((a, b) => a.display_order - b.display_order)
        .map((variant) => {
          const disabled = !variant.is_available || (variant.stock_quantity ?? 0) <= 0;
          return (
<RadioGroup.Option
  key={variant.id}
  value={variant.id}
  disabled={disabled}
  className={({ checked }) =>
    `relative flex flex-col items-start justify-between rounded-lg border p-3 min-h-[88px] transition-colors
     ${checked ? "bg-primary/10 border-primary" : "bg-card border-border"}
     ${disabled ? "opacity-50 cursor-not-allowed" : ""}
    `
  }
>

              {({ checked }) => (
                <>
                  {/* top row: weight + badge */}
                  <div className="w-full flex items-start justify-between">
                    <div className="text-sm font-medium">
                      {formatWeight(variant)}
                    </div>

      
                  </div>

                  {/* middle: price */}
                  <div className="mt-2 text-sm font-semibold">
                    ₹{variant.price}
                  </div>

                  {/* bottom row: selector square */}
                  <div className="absolute top-3 right-3">
                    <div
                      className={`h-5 w-5 rounded-sm border flex items-center justify-center ${
                        checked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-transparent"
                      }`}
                      aria-hidden
                    >
                      {checked && <div className="h-2.5 w-2.5 bg-white rounded-sm" />}
                    </div>
                  </div>

                  {/* overlay text for disabled / out of stock */}
                  {disabled && (
                    <div className="absolute inset-0 rounded-lg bg-white/0 pointer-events-none flex items-center justify-center mt-2">
                      <span className="mb-2 text-xs text-muted-foreground">
                        {!variant.is_available ? "Unavailable" : "Out of stock"}
                      </span>
                    </div>
                  )}
                </>
              )}
            </RadioGroup.Option>
          );
        })}
    </RadioGroup>

    {/* SKU / helper text */}
    {selectedVariant && selectedVariant.sku && (
      <p className="text-xs text-muted-foreground mt-1">SKU: {selectedVariant.sku}</p>
    )}
  </div>
)}

          {ingredients.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Ingredients:</h3>
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ingredient) => (
                  <Badge 
                    key={ingredient.id} 
                    variant={ingredient.is_allergen ? "destructive" : "secondary"}
                  >
                    {ingredient.name}
                    {ingredient.is_allergen && " ⚠️"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="font-semibold">Quantity:</span>
              <div className="flex items-center border rounded-md">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={!isInStock()}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={!isInStock()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {product.min_order_quantity > 1 && (
                <span className="text-sm text-muted-foreground">
                  Min: {product.min_order_quantity}
                </span>
              )}
              {product.max_order_quantity && (
                <span className="text-sm text-muted-foreground">
                  Max: {product.max_order_quantity}
                </span>
              )}
            </div>

            <Button 
              size="lg" 
              className="w-full md:w-auto" 
              onClick={handleAddToCart}
              disabled={!isInStock()}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {!isInStock() ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section>
          <h2 className="text-3xl font-display font-bold mb-6">
            Related <span className="text-accent">Products</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard 
                key={relatedProduct.id} 
                product={{
                  id: relatedProduct.slug,
                  name: relatedProduct.name,
                  price: relatedProduct.price,
                  image: getProductImage(relatedProduct),
                  category: relatedProduct.categories?.name || 'Uncategorized',
                  isNew: relatedProduct.is_new,
                  rating: relatedProduct.rating || undefined,
                  originalPrice: relatedProduct.original_price || undefined,
                  description: relatedProduct.description || undefined,
                  stock: relatedProduct.stock_quantity,
                  review_count: relatedProduct.review_count || undefined,
                }} 
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetail;