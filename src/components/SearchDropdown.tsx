// src/components/SearchDropdown.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase";
import { toast } from "sonner";

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
  categories?: { name: string; slug: string };
  product_images?: { image_url: string; is_primary: boolean }[];
}

interface SearchDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  searchRef: React.RefObject<HTMLDivElement>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchDropdown = ({ isOpen, onClose, searchRef, searchQuery, setSearchQuery }: SearchDropdownProps) => {
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, searchRef]);

  // Function to fetch search results
  const fetchSearchResults = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (name, slug),
          product_images (image_url, is_primary)
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_available', true)
        .limit(8);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Failed to search products');
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch results when searchQuery changes
  useEffect(() => {
    if (isOpen) {
      fetchSearchResults(searchQuery);
    }
  }, [searchQuery, isOpen]);

  // Handle search submission
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      // Navigate to products page with search query
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      onClose();
    }
  };

  // Handle product click
  const handleProductClick = (productSlug: string) => {
    navigate(`/products/${productSlug}`);
    onClose();
  };

  // Get product image
  const getProductImage = (product: Product) => {
    if (product.image_url) return product.image_url;
    const primaryImage = product.product_images?.find(img => img.is_primary);
    if (primaryImage) return primaryImage.image_url;
    return product.product_images?.[0]?.image_url || 'https://via.placeholder.com/400';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-[500px] overflow-hidden"
        >
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium">Search Results</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSearchSubmit}
              disabled={!searchQuery.trim()}
            >
              View All Results
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <div className="overflow-y-auto max-h-[400px] p-4">
            {isSearching ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-2 text-muted-foreground">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleProductClick(product.slug)}
                    className="cursor-pointer"
                  >
                    <ProductCard
                      product={{
                        id: product.slug,
                        name: product.name,
                        price: product.price,
                        image: getProductImage(product),
                        category: product.categories?.name || 'Uncategorized',
                        isNew: product.is_new,
                        rating: product.rating || undefined,
                        review_count: product.review_count || undefined,
                        originalPrice: product.original_price || undefined,
                        description: product.description || undefined,
                        stock: product.stock_quantity,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No products found for "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground mt-2">Try searching with different keywords</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Start typing to search for products</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchDropdown;