// src/pages/Search.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon, X, ArrowRight } from "lucide-react"; // Rename to SearchIcon
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase";
import { toast } from "sonner";
import { PageContainer } from '@/components/layout/PageContainer';

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

const SearchPage = () => { // Rename component to avoid conflict
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

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
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Failed to search products');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Update URL params
    if (query.trim()) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
    
    // Fetch results as user types
    fetchSearchResults(query);
    setShowResults(true);
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to products page with search query
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Handle product click
  const handleProductClick = (productSlug: string) => {
    navigate(`/products/${productSlug}`);
  };

  // Get product image
  const getProductImage = (product: Product) => {
    if (product.image_url) return product.image_url;
    const primaryImage = product.product_images?.find(img => img.is_primary);
    if (primaryImage) return primaryImage.image_url;
    return product.product_images?.[0]?.image_url || 'https://via.placeholder.com/400';
  };

  // Close search results
  const closeSearchResults = () => {
    setShowResults(false);
  };

  // Initial search if query is in URL params
  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      fetchSearchResults(query);
      setShowResults(true);
    }
  }, []);

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        {/* Search Header */}
        <div className="relative mb-8">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for products..."
                className="pl-12 pr-12 h-14 text-lg"
                value={searchQuery}
                onChange={handleSearchChange}
                autoFocus
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>
            <Button type="submit" className="mt-4 w-full">
              Search Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Search Results */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {isSearching ? (
                <div className="text-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="mt-2 text-muted-foreground">Searching...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                      {searchResults.length} results for "{searchQuery}"
                    </h2>
                    <Button variant="ghost" onClick={closeSearchResults}>
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                </>
              ) : searchQuery ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No products found for "{searchQuery}"</p>
                  <p className="text-sm text-muted-foreground mt-2">Try searching with different keywords</p>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageContainer>
  );
};

export default SearchPage;