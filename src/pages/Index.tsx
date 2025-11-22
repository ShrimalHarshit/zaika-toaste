// src/pages/Index.tsx - Using React Query properly
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Sandwich, Cookie, Cake, Coffee, RefreshCw, Search } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CategoryGrid from '@/components/categories/categories-grid';
import { Badge } from "@/components/ui/badge";
import { PageContainer } from '@/components/layout/PageContainer';
import { CartPanel } from '@/components/cart/CartPanel';
import { FilterCategory } from '@/types';
import { supabase } from "@/integrations/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import heroBanner from "../assets/heroBanner.jpg";
import SearchDropdown from "@/components/SearchDropdown";

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

const ZaikaLoader = () => {
  const [loadingStage, setLoadingStage] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStage((prev) => (prev + 1) % 4);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="relative w-64 h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-2xl">ZT</span>
            </div>
            <div className="absolute inset-0 opacity-30">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-4 bg-white rounded-full"
                  style={{
                    top: `${20 + Math.random() * 60}%`,
                    left: `${20 + Math.random() * 60}%`,
                    transform: `rotate(${Math.random() * 360}deg)`
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
        
        {[Sandwich, Cookie, Cake, Coffee].map((Icon, index) => (
          <motion.div
            key={index}
            className="absolute inset-0 flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 12 + index * 2, 
              repeat: Infinity, 
              ease: "linear",
            }}
          >
            <motion.div
              className="absolute"
              style={{
                transform: `translateX(80px) rotate(${index * 90}deg)`
              }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                loadingStage === index ? 'bg-orange-500' : 'bg-amber-200'
              }`}>
                <Icon className={`w-5 h-5 ${
                  loadingStage === index ? 'text-white' : 'text-amber-600'
                }`} />
              </div>
            </motion.div>
          </motion.div>
        ))}
        
        <div className="absolute -bottom-16 left-0 right-0 text-center">
          <p className="text-orange-600 font-medium">Baking something special...</p>
          <div className="flex justify-center mt-2 space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-orange-400 rounded-full"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// SINGLE query function that fetches ALL needed products
const fetchAllProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories (name, slug),
      product_images (image_url, is_primary)
    `)
    .or('is_featured.eq.true,is_new.eq.true,rating.gte.4')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
};

const Index = () => {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showLoader, setShowLoader] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // USE REACT QUERY - it handles caching, refetching, deduplication automatically
  const { 
    data: allProducts = [], 
    isLoading,
    isError,
    error,
    refetch 
  } = useQuery({
    queryKey: ['homepage-products'], // Unique key for this query
    queryFn: fetchAllProducts,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: false, // Don't refetch if data is fresh
    retry: 2, // Retry failed requests 2 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Filter in memory - MUCH faster than separate queries
  const featuredProducts = useMemo(() => 
    allProducts.filter(p => p.is_featured).slice(0, 6),
    [allProducts]
  );

  const newProducts = useMemo(() => 
    allProducts.filter(p => p.is_new).slice(0, 6),
    [allProducts]
  );

  const popularProducts = useMemo(() => 
    allProducts
      .filter(p => p.rating && p.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6),
    [allProducts]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowLoader(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Handle search bar focus
  const handleSearchFocus = () => {
    setIsSearchDropdownOpen(true);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Open dropdown if there's a query
    if (query.trim()) {
      setIsSearchDropdownOpen(true);
    }
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchDropdownOpen(false);
    }
  };

  // Close search dropdown
  const closeSearchDropdown = () => {
    setIsSearchDropdownOpen(false);
  };

  // Close dropdown when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSearchDropdown();
      }
    };

    if (isSearchDropdownOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchDropdownOpen]);

  const getProductImage = (product: Product) => {
    if (product.image_url) return product.image_url;
    const primaryImage = product.product_images?.find(img => img.is_primary);
    if (primaryImage) return primaryImage.image_url;
    return product.product_images?.[0]?.image_url || 'https://via.placeholder.com/400';
  };

  const ProductSection = ({ title, products, viewAllLink, badgeColor }: {
    title: string;
    products: Product[];
    viewAllLink: string;
    badgeColor?: string;
  }) => (
    <section className="py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <Link to={viewAllLink}>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </Link>
      </div>
      
      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {products.map((product) => (
            <ProductCard 
              key={product.id} 
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
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No products available in this category.</p>
        </div>
      )}
    </section>
  );

  if (showLoader) {
    return <ZaikaLoader />;
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="flex flex-col lg:flex-row w-full">
        <div className="flex-1 w-full pb-16 lg:pb-0">
          <PageContainer>
            {/* Search Bar Section */}
            <div className="relative mb-4">
              <div ref={searchRef} className="relative max-w-md mx-auto">
                <form onSubmit={handleSearchSubmit} className="w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="What would you like to eat?"
                    className="pl-10 pr-10 h-12 text-base"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={handleSearchFocus}
                  />
                </form>
                
                {/* Search Dropdown */}
                <SearchDropdown 
                  isOpen={isSearchDropdownOpen} 
                  onClose={closeSearchDropdown}
                  searchRef={searchRef}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              </div>
            </div>

            <div className="relative mb-2 w-full overflow-hidden rounded-3xl bg-stone-800 shadow-card-hover">
              <div className="relative flex items-center">
                <div className="flex w-full max-w-full flex-col items-center gap-4 p-2 md:flex-row md:p-6">
                  <div className="w-full md:hidden">
                    <img
                      src={heroBanner}
                      alt="Zaika Toasts"
                      className="h-40 w-full max-w-full rounded-2xl object-cover"
                    />
                  </div>
                  <div className="hidden w-full md:block md:w-1/2">
                    <img
                      src={heroBanner}
                      alt="Zaika Toasts"
                      className="h-56 w-full max-w-full rounded-2xl object-cover lg:h-64"
                    />
                  </div>
                </div>
              </div>
            </div>

            <CategoryGrid />

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading delicious products...</p>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-destructive">Failed to load products</p>
                <p className="text-sm text-muted-foreground">{error?.message}</p>
                <Button onClick={() => refetch()} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                <ProductSection 
                  title="Featured Products" 
                  products={featuredProducts}
                  viewAllLink="/products?filter=featured"
                  badgeColor="bg-orange-500"
                />

                <ProductSection 
                  title="New Arrivals" 
                  products={newProducts}
                  viewAllLink="/products?filter=new"
                  badgeColor="bg-green-500"
                />

                <ProductSection 
                  title="Customer Favorites" 
                  products={popularProducts}
                  viewAllLink="/products?filter=popular"
                  badgeColor="bg-purple-500"
                />
              </>
            )}
          </PageContainer>
        </div>

        <div className="hidden lg:block lg:w-96 lg:flex-shrink-0 border-l">
          <CartPanel />
        </div>
      </div>
    </div>
  );
};

export default Index;