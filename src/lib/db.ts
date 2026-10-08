import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Overridable so hosts with persistent disks (Render, Fly) can mount the DB
// on a volume instead of the app directory.
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "axisops.db");

export type User = {
  id: number;
  name: string;
  username: string;
  account_type: "individual" | "seller" | "professional" | "business" | "institution" | "employer";
  location: string;
  phone: string;
  email: string;
  joined_at: string;
  bio: string;
};

export type Listing = {
  id: number;
  user_id: number;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  negotiable: number;
  condition: string;
  location: string;
  region: string;
  status: "active" | "sold" | "reserved" | "pending" | "expired";
  featured: number;
  listing_type: "product" | "service" | "property" | "vehicle" | "job";
  emoji: string;
  color: string;
  /** Stock photo for listings without uploaded images (Pexels, cached). */
  image_url: string | null;
  views: number;
  created_at: string;
};

export type Offer = {
  id: number;
  listing_id: number;
  buyer_id: number;
  amount: number;
  message: string;
  status: "pending" | "accepted" | "rejected" | "countered";
  counter_amount: number | null;
  created_at: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'individual',
  location TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  bio TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GHS',
  negotiable INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'Used',
  location TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  featured INTEGER NOT NULL DEFAULT 0,
  listing_type TEXT NOT NULL DEFAULT 'product',
  emoji TEXT NOT NULL DEFAULT '📦',
  color TEXT NOT NULL DEFAULT '#12A44C',
  image_url TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id),
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  counter_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers(listing_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signin',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id, read_at);

CREATE TABLE IF NOT EXISTS listing_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  filename TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_listing ON listing_photos(listing_id, position);
`;

export const CATEGORIES: {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  type: Listing["listing_type"];
  subs: string[];
}[] = [
  { slug: "electronics", name: "Electronics", emoji: "📱", color: "#2563EB", type: "product", subs: ["Phones", "Computers", "TVs", "Cameras", "Gaming", "Audio", "Appliances"] },
  { slug: "vehicles", name: "Vehicles", emoji: "🚗", color: "#DC2626", type: "vehicle", subs: ["Cars", "Motorcycles", "Trucks", "Buses", "Spare Parts", "Vehicle Services"] },
  { slug: "property", name: "Property", emoji: "🏠", color: "#7C3AED", type: "property", subs: ["Houses for Rent", "Houses for Sale", "Land", "Apartments", "Offices", "Shops", "Short Stay"] },
  { slug: "fashion", name: "Fashion", emoji: "👗", color: "#DB2777", type: "product", subs: ["Men's Clothing", "Women's Clothing", "Shoes", "Bags", "Jewellery", "Watches"] },
  { slug: "home", name: "Home & Furniture", emoji: "🛋️", color: "#0D9488", type: "product", subs: ["Furniture", "Kitchen", "Home Appliances", "Décor", "Bedding"] },
  { slug: "agriculture", name: "Agriculture", emoji: "🌾", color: "#65A30D", type: "product", subs: ["Farm Produce", "Livestock", "Seeds", "Farm Equipment", "Agri Services"] },
  { slug: "food", name: "Food & Catering", emoji: "🍲", color: "#EA580C", type: "service", subs: ["Restaurants", "Groceries", "Cakes", "Catering", "Food Delivery"] },
  { slug: "services", name: "Services", emoji: "🛠️", color: "#0369A1", type: "service", subs: ["Construction", "Plumbing", "Electrical", "Repairs", "Transport", "Cleaning", "IT", "Education", "Legal", "Accounting", "Marketing", "Consulting"] },
  { slug: "jobs", name: "Jobs", emoji: "💼", color: "#4F46E5", type: "job", subs: ["Full-time", "Part-time", "Contract", "Remote", "Internship", "Apprenticeship"] },
  { slug: "beauty", name: "Beauty & Health", emoji: "💇", color: "#C026D3", type: "service", subs: ["Hairdressing", "Beauticians", "Skincare", "Fitness", "Caterers"] },
  { slug: "education", name: "Education", emoji: "📚", color: "#CA8A04", type: "service", subs: ["Tutoring", "Courses", "Schools", "Universities", "Training Centres"] },
];

type SeedUser = Omit<User, "id" | "joined_at">;

const SEED_USERS: SeedUser[] = [
  { name: "Kwame Mensah", username: "kwame", account_type: "individual", location: "Accra, Greater Accra", phone: "+233 24 000 0001", email: "kwame@axisops.app", bio: "Demo account — you are signed in as Kwame. Buy, sell and post listings." },
  { name: "TechHub Ghana", username: "techhub", account_type: "business", location: "Accra, Greater Accra", phone: "+233 30 200 1111", email: "sales@techhub.gh", bio: "Ghana's trusted electronics store. Phones, laptops, accessories with warranty." },
  { name: "Lux Fashion House", username: "luxfashion", account_type: "seller", location: "Kumasi, Ashanti", phone: "+233 20 300 2222", email: "hello@luxfashion.gh", bio: "Modern fashion, kente collections and accessories delivered nationwide." },
  { name: "Home Comforts Ltd", username: "homecomforts", account_type: "business", location: "Tema, Greater Accra", phone: "+233 50 400 3333", email: "orders@homecomforts.gh", bio: "Furniture and home appliances at honest prices. Free delivery in Accra." },
  { name: "Kofi Boateng", username: "kofib", account_type: "individual", location: "Madina, Greater Accra", phone: "+233 55 500 4444", email: "kofi.b@mail.com", bio: "Selling personal items. Meet-ups around Madina and East Legon." },
  { name: "Accra Property Associates", username: "accraproperty", account_type: "business", location: "East Legon, Greater Accra", phone: "+233 24 600 5555", email: "listings@accraproperty.gh", bio: "Estates agent specialising in rentals, land and short stays across Accra." },
  { name: "Dr. Ama Owusu", username: "amaowusu", account_type: "professional", location: "Accra, Greater Accra", phone: "+233 27 700 6666", email: "dr.owusu@axisops.app", bio: "Licensed medical doctor. Teleconsultations and home visits in Greater Accra." },
  { name: "Bright Spark Electricals", username: "brightspark", account_type: "professional", location: "Kumasi, Ashanti", phone: "+233 24 800 7777", email: "call@brightspark.gh", bio: "Certified electricians — wiring, solar installation, generator servicing." },
  { name: "Nana Akua Catering", username: "nanaakua", account_type: "professional", location: "Takoradi, Western", phone: "+233 54 900 8888", email: "events@nanaakua.gh", bio: "Weddings, corporate events and parties. Local & continental menus." },
  { name: "Gateway Schools", username: "gatewayschools", account_type: "institution", location: "Accra, Greater Accra", phone: "+233 30 250 9999", email: "admissions@gateway.gh", bio: "Creche through JHS. Admissions open for the 2027 academic year." },
  { name: "Grandview Motors", username: "grandview", account_type: "business", location: "Accra, Greater Accra", phone: "+233 55 100 2222", email: "sales@grandviewmotors.gh", bio: "Quality used imports. Inspection reports and warranty on every car." },
  { name: "Yaw Asante Farms", username: "yawfarms", account_type: "business", location: "Ejisu, Ashanti", phone: "+233 26 200 3333", email: "yawasante@farms.gh", bio: "Fresh farm produce direct from Ejisu — plantain, cassava, maize, poultry." },
];

const descriptionFallback =
  "Ergonomic mesh office chair with lumbar support, adjustable height and armrests. Used in a home office for 6 months, no tears. Pickup in Madina.";

type SeedListing = {
  user: string;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  price: number;
  condition?: string;
  location: string;
  region: string;
  type?: Listing["listing_type"];
  emoji: string;
  color: string;
  featured?: boolean;
  negotiable?: number;
  views?: number;
  daysAgo?: number;
};

const SEED_LISTINGS: SeedListing[] = [
  { user: "techhub", category: "electronics", subcategory: "Phones", title: "iPhone 15 Pro Max 256GB — Natural Titanium", description: "Brand new, sealed. Comes with original box, cable and 1-year local warranty. Available in Natural Titanium and Blue Titanium. Same-day delivery in Accra.", price: 12500, condition: "New", location: "Osu, Accra", region: "Greater Accra", emoji: "📱", color: "#2563EB", featured: true, views: 2841, daysAgo: 1 },
  { user: "techhub", category: "electronics", subcategory: "Phones", title: "Samsung Galaxy S24 Ultra 512GB", description: "Sealed unit with S Pen. Includes free screen protector installation and 12-month warranty.", price: 11800, condition: "New", location: "Osu, Accra", region: "Greater Accra", emoji: "📱", color: "#2563EB", views: 1520, daysAgo: 2 },
  { user: "techhub", category: "electronics", subcategory: "Computers", title: "HP EliteBook 840 G8 — i7/16GB/512GB SSD", description: "USA pickup grade A. Perfect for students and professionals. Comes with charger and 6-month warranty.", price: 6200, condition: "Used", location: "Osu, Accra", region: "Greater Accra", emoji: "💻", color: "#2563EB", views: 987, daysAgo: 4 },
  { user: "kofib", category: "electronics", subcategory: "Gaming", title: "PlayStation 5 Slim + 2 Controllers", description: "Barely used, 4 months old. All cables, stands and receipts available. GTA VI bundle ready.", price: 4800, condition: "Like new", location: "Madina, Accra", region: "Greater Accra", emoji: "🎮", color: "#2563EB", negotiable: 1, views: 1330, daysAgo: 3 },
  { user: "techhub", category: "electronics", subcategory: "TVs", title: "LG 55\" 4K Smart TV (2024 Model)", description: "WebOS, Netflix & YouTube built in. Wall mount included. Free delivery within Accra-Tema.", price: 3900, condition: "New", location: "Tema, Accra", region: "Greater Accra", emoji: "📺", color: "#2563EB", views: 764, daysAgo: 6 },
  { user: "kofib", category: "electronics", subcategory: "Cameras", title: "Canon EOS 250D + 18-55mm Lens", description: "Great for content creators. Shutter count under 8k. Bag and 64GB card included.", price: 4300, condition: "Used", location: "East Legon, Accra", region: "Greater Accra", emoji: "📷", color: "#2563EB", views: 512, daysAgo: 9 },

  { user: "grandview", category: "vehicles", subcategory: "Cars", title: "Toyota Corolla 2012 — 1.8L Automatic", description: "Clean title, non-accident. New tyres, recent service. VIN available on request. Inspection report ready.", price: 138000, condition: "Used", location: "Spintex, Accra", region: "Greater Accra", emoji: "🚗", color: "#DC2626", featured: true, views: 3102, daysAgo: 2 },
  { user: "grandview", category: "vehicles", subcategory: "Cars", title: "Toyota Camry 2016 LE — Low Mileage", description: "62,000 km. Leather interior, reverse camera, alloy wheels. Financing available through partner banks.", price: 215000, condition: "Used", location: "Spintex, Accra", region: "Greater Accra", emoji: "🚗", color: "#DC2626", views: 2210, daysAgo: 5 },
  { user: "kofib", category: "vehicles", subcategory: "Cars", title: "Kia Rio 2014 Sedan — Very Clean", description: "Second owner, garage-kept. Full service history at Kantamanto Motors. negotiable for serious buyer.", price: 98000, condition: "Used", location: "Madina, Accra", region: "Greater Accra", emoji: "🚗", color: "#DC2626", views: 1440, daysAgo: 7 },
  { user: "grandview", category: "vehicles", subcategory: "Motorcycles", title: "TVS HLX 125 — Delivery Motorbike", description: "2023 model, 4,200 km. Ideal for delivery business. Includes top box.", price: 14500, condition: "Used", location: "Kumasi, Ashanti", region: "Ashanti", emoji: "🏍️", color: "#DC2626", views: 690, daysAgo: 8 },

  { user: "accraproperty", category: "property", subcategory: "Houses for Rent", title: "3-Bedroom Apartment, East Legon — Gated Community", description: "All rooms en-suite, fitted kitchen, 24/7 security, standby generator, parking for 3. Rent per year, 2 years advance accepted.", price: 45000, condition: "Furnished", location: "East Legon, Accra", region: "Greater Accra", type: "property", emoji: "🏠", color: "#7C3AED", featured: true, negotiable: 0, views: 4120, daysAgo: 1 },
  { user: "accraproperty", category: "property", subcategory: "Apartments", title: "2-Bedroom Flat, Madina — Near Down Town", description: "Newly built, tiled throughout, pop ceiling, water tank, meter ready. Family units only.", price: 18000, condition: "New", location: "Madina, Accra", region: "Greater Accra", type: "property", emoji: "🏢", color: "#7C3AED", views: 1860, daysAgo: 4 },
  { user: "accraproperty", category: "property", subcategory: "Land", title: "Plot of Land, Tema Community 25 — C of O", description: "100x70ft, fenced on 3 sides, accessible road, electricity nearby. Clean title, no encumbrances.", price: 280000, condition: "New", location: "Tema, Greater Accra", region: "Greater Accra", type: "property", emoji: "🌱", color: "#7C3AED", views: 2450, daysAgo: 6 },
  { user: "accraproperty", category: "property", subcategory: "Short Stay", title: "Luxury 1-Bedroom Short Stay, Labone", description: "Nightly rate. Pool, gym, WiFi, full kitchen. Perfect for business trips and visitors.", price: 650, condition: "Furnished", location: "Labone, Accra", region: "Greater Accra", type: "property", emoji: "🏝️", color: "#7C3AED", negotiable: 0, views: 1210, daysAgo: 3 },
  { user: "accraproperty", category: "property", subcategory: "Offices", title: "Serviced Office Space, Osu — 12 Desks", description: "Move-in ready, meeting room, reception, fibre internet, parking. Monthly rate inclusive of service charge.", price: 9500, condition: "Furnished", location: "Osu, Accra", region: "Greater Accra", type: "property", emoji: "🖥️", color: "#7C3AED", views: 640, daysAgo: 11 },

  { user: "luxfashion", category: "fashion", subcategory: "Women's Clothing", title: "Handmade Kente Wrap Dress — Special Occasion", description: "Authentic Bonwire kente, lined and hand-stitched. Sizes S–XL, made to order in 4 days. Nationwide delivery.", price: 850, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", emoji: "👗", color: "#DB2777", featured: true, views: 1780, daysAgo: 2 },
  { user: "luxfashion", category: "fashion", subcategory: "Men's Clothing", title: "Men's Linen Shirt — Breathable, 6 Colours", description: "Perfect for Ghana weather. Sizes M–XXL. Buy 2 get 10% off.", price: 180, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", emoji: "👔", color: "#DB2777", views: 620, daysAgo: 5 },
  { user: "luxfashion", category: "fashion", subcategory: "Shoes", title: "Leather Loafers — Handcrafted in Kumasi", description: "Full grain leather, sizes 39–46. Comfortable for office and events.", price: 320, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", emoji: "👞", color: "#DB2777", views: 480, daysAgo: 8 },
  { user: "luxfashion", category: "fashion", subcategory: "Bags", title: "Premium Leather Tote Bag — Work Ready", description: "Fits 15-inch laptop, padded compartment, adjustable strap.", price: 420, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", emoji: "👜", color: "#DB2777", views: 356, daysAgo: 10 },

  { user: "homecomforts", category: "home", subcategory: "Furniture", title: "Modern 3-Seater Sofa — Charcoal Fabric", description: "Solid wood frame, high density foam. Free delivery within Accra-Tema. 1-year warranty.", price: 3200, condition: "New", location: "Tema, Greater Accra", region: "Greater Accra", emoji: "🛋️", color: "#0D9488", featured: true, views: 2010, daysAgo: 2 },
  { user: "homecomforts", category: "home", subcategory: "Home Appliances", title: "Hisense 250L Refrigerator — Dual Door", description: "Energy saving, frost free. 2-year compressor warranty. Delivery nationwide.", price: 2450, condition: "New", location: "Tema, Greater Accra", region: "Greater Accra", emoji: "🧊", color: "#0D9488", views: 1120, daysAgo: 5 },
  { user: "homecomforts", category: "home", subcategory: "Furniture", title: "6-Seater Dining Table Set — Mahogany", description: "Handcrafted mahogany with cushioned chairs. Matches any dining room.", price: 4800, condition: "New", location: "Tema, Greater Accra", region: "Greater Accra", emoji: "🍽️", color: "#0D9488", views: 870, daysAgo: 7 },
  { user: "kofib", category: "home", subcategory: "Home Appliances", title: "Samsung Washing Machine 8kg — Front Load", description: "Used for 8 months, working perfectly. Selling because we are relocating.", price: 2100, condition: "Like new", location: "Madina, Accra", region: "Greater Accra", emoji: "🧺", color: "#0D9488", views: 590, daysAgo: 6 },

  { user: "yawfarms", category: "agriculture", subcategory: "Farm Produce", title: "Fresh Plantain Bunches — Bulk Supply", description: "Harvested weekly in Ejisu. Minimum 20 bunches. Price per bunch, discount for 100+. Accra delivery available.", price: 45, condition: "New", location: "Ejisu, Ashanti", region: "Ashanti", emoji: "🍌", color: "#65A30D", views: 720, daysAgo: 1 },
  { user: "yawfarms", category: "agriculture", subcategory: "Farm Produce", title: "Premium Rice (50kg Bag) — Irrigated Farm", description: "Clean, stone-free, sun dried. Available in 50kg and 25kg bags. Warehouse in Kumasi.", price: 620, condition: "New", location: "Ejisu, Ashanti", region: "Ashanti", emoji: "🍚", color: "#65A30D", views: 940, daysAgo: 3 },
  { user: "yawfarms", category: "agriculture", subcategory: "Livestock", title: "Broiler Chickens — Live, 100 Available", description: "6 weeks old, healthy flock, vaccinated. Sold per bird or in dozens. Farm pickup or Accra delivery.", price: 60, condition: "New", location: "Ejisu, Ashanti", region: "Ashanti", emoji: "🐔", color: "#65A30D", views: 610, daysAgo: 4 },
  { user: "yawfarms", category: "agriculture", subcategory: "Farm Produce", title: "Farm Fresh Eggs — Crates of 30", description: "Layer eggs from healthy flock. Daily supply to restaurants and shops. Price per crate.", price: 55, condition: "New", location: "Ejisu, Ashanti", region: "Ashanti", emoji: "🥚", color: "#65A30D", views: 430, daysAgo: 9 },

  { user: "nanaakua", category: "food", subcategory: "Catering", title: "Party Wollof & Chicken Trays — 50 People", description: "Includes shito, salad and bottled water. Serving staff available at extra cost. 48-hour notice.", price: 3500, condition: "New", location: "Takoradi, Western", region: "Western", type: "service", emoji: "🍲", color: "#EA580C", views: 1340, daysAgo: 2 },
  { user: "nanaakua", category: "food", subcategory: "Cakes", title: "Custom Birthday Cakes — 3 Tiers", description: "Butter cream or fondant, personalised message, fresh ingredients. Order 3 days ahead.", price: 480, condition: "New", location: "Takoradi, Western", region: "Western", type: "service", emoji: "🎂", color: "#EA580C", views: 880, daysAgo: 6 },

  { user: "brightspark", category: "services", subcategory: "Electrical", title: "Certified Electrician — House Wiring & Repairs", description: "Licensed ECG-compliant wiring, fault finding, DB board installation, solar & inverter setup. Free quote after site visit in Kumasi.", price: 250, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", type: "service", emoji: "⚡", color: "#0369A1", featured: true, views: 1560, daysAgo: 1 },
  { user: "brightspark", category: "services", subcategory: "Electrical", title: "Solar & Inverter Installation — 5kVA to 20kVA", description: "Complete system design, panels, batteries, installation and commissioning. Financing plans available.", price: 18500, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", type: "service", emoji: "🔋", color: "#0369A1", views: 1120, daysAgo: 5 },
  { user: "amaowusu", category: "services", subcategory: "Education", title: "JHS Mathematics Tutoring — Home or Online", description: "BECE prep specialist, 8 years experience. Weekly or intensive holiday classes. First session free.", price: 120, condition: "New", location: "Accra, Greater Accra", region: "Greater Accra", type: "service", emoji: "📐", color: "#0369A1", views: 760, daysAgo: 3 },
  { user: "amaowusu", category: "beauty", subcategory: "Hairdressing", title: "Mobile Hairdresser — Braids, Wigs & Styling", description: "We come to you. Braiding from GH₵80, wig revamp GH₵150. Book 24 hours ahead.", price: 80, condition: "New", location: "Accra, Greater Accra", region: "Greater Accra", type: "service", emoji: "💇", color: "#C026D3", views: 980, daysAgo: 2 },
  { user: "amaowusu", category: "beauty", subcategory: "Skincare", title: "Professional Facial & Skincare Package", description: "4-session package: cleansing, exfoliation, mask and LED therapy. Labone clinic or home visit.", price: 600, condition: "New", location: "Labone, Accra", region: "Greater Accra", type: "service", emoji: "✨", color: "#C026D3", views: 540, daysAgo: 8 },

  { user: "gatewayschools", category: "jobs", subcategory: "Full-time", title: "Primary School Teacher — English & Science", description: "NCTE certified, 2+ years experience. Submit CV and certificates. Salary: GH₵2,800/month.", price: 2800, condition: "New", location: "Accra, Greater Accra", region: "Greater Accra", type: "job", emoji: "💼", color: "#4F46E5", views: 1670, daysAgo: 4 },
  { user: "grandview", category: "jobs", subcategory: "Full-time", title: "Sales Executive — Automotive Dealership", description: "Commission + salary. Must have valid licence and customer-facing experience. Salary: GH₵2,000 + commission.", price: 2000, condition: "New", location: "Accra, Greater Accra", region: "Greater Accra", type: "job", emoji: "💼", color: "#4F46E5", views: 1230, daysAgo: 7 },
  { user: "homecomforts", category: "jobs", subcategory: "Apprenticeship", title: "Furniture Fitting Apprentice Wanted", description: "Learn carpentry and upholstery with experienced craftsmen. Small stipend, 12-month programme.", price: 500, condition: "New", location: "Tema, Greater Accra", region: "Greater Accra", type: "job", emoji: "🪚", color: "#4F46E5", views: 680, daysAgo: 10 },

  { user: "kofib", category: "electronics", subcategory: "Audio", title: "JBL Charge 5 Speaker — Sealed", description: "Bought from Jumia, used twice. Box and cable available. Battery lasts 20 hours.", price: 1150, condition: "Like new", location: "Madina, Accra", region: "Greater Accra", emoji: "🔊", color: "#2563EB", views: 420, daysAgo: 12 },
  { user: "luxfashion", category: "fashion", subcategory: "Jewellery", title: "Gold-Plated Bead Necklace Set — Handmade", description: "Necklace and earrings set. Perfect for weddings. Gift box included.", price: 260, condition: "New", location: "Kumasi, Ashanti", region: "Ashanti", emoji: "📿", color: "#DB2777", views: 390, daysAgo: 13 },
  { user: "accraproperty", category: "property", subcategory: "Shops", title: "Shop Space for Rent, Madina Market", description: "High foot traffic, 12ft by 15ft, roller shutter, storage room behind. Monthly rent.", price: 1200, condition: "New", location: "Madina, Accra", region: "Greater Accra", type: "property", emoji: "🏪", color: "#7C3AED", views: 770, daysAgo: 14 },
];

let _db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  // Lightweight in-place migration for DBs created before these columns existed
  const ensureColumn = (table: string, ddl: string) => {
    try { db.exec(ddl); } catch { /* already exists */ }
  };
  ensureColumn("users", "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  ensureColumn("users", "ALTER TABLE users ADD COLUMN account_id TEXT");
  // Trust tiers (Phase 5): phone verification is inherent to OTP sign-up;
  // ID and business verification are granted by an admin.
  ensureColumn("users", "ALTER TABLE users ADD COLUMN id_verified INTEGER NOT NULL DEFAULT 0");
  ensureColumn("users", "ALTER TABLE users ADD COLUMN business_verified INTEGER NOT NULL DEFAULT 0");
  ensureColumn("listings", "ALTER TABLE listings ADD COLUMN image_url TEXT");
  // Legacy demo rating columns (pre-escrow reviews) — ratings now come from
  // the reviews table exclusively, so drop them from existing databases.
  ensureColumn("users", "ALTER TABLE users DROP COLUMN rating");
  ensureColumn("users", "ALTER TABLE users DROP COLUMN reviews");
  ensureColumn("users", "ALTER TABLE users DROP COLUMN response_rate");
  ensureColumn("users", "ALTER TABLE users DROP COLUMN verified");
  _db = db;
  return db;
}

function seed(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (row.c > 0) return;

  const insertUser = db.prepare(
    `INSERT INTO users (name, username, account_type, location, phone, email, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const userIds = new Map<string, number>();
  for (const u of SEED_USERS) {
    const res = insertUser.run(
      u.name, u.username, u.account_type, u.location, normalizePhone(u.phone), u.email, u.bio
    );
    userIds.set(u.username, Number(res.lastInsertRowid));
  }

  const insertListing = db.prepare(
    `INSERT INTO listings (user_id, category, subcategory, title, description, price, negotiable, condition, location, region, status, featured, listing_type, emoji, color, views, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, datetime('now', ?))`
  );
  for (const l of SEED_LISTINGS) {
    insertListing.run(
      userIds.get(l.user) ?? 1,
      l.category,
      l.subcategory,
      l.title,
      l.description,
      l.price,
      l.negotiable ?? 1,
      l.condition ?? "Used",
      l.location,
      l.region,
      l.featured ? 1 : 0,
      l.type ?? "product",
      l.emoji,
      l.color,
      l.views ?? 0,
      `-${l.daysAgo ?? 5} days`
    );
  }

  const kwame = userIds.get("kwame")!;

  // Kwame's own listings (demo "you" account) so the seller dashboard has content
  const kwameListings: [string, string][] = [
    ["iPhone 12 128GB — Black, Excellent Condition", "Selling my iPhone 12. Battery health 89%, no scratches, always used with case and screen protector. Comes with original cable. Meet-ups around Madina or East Legon."],
    ["Ergonomic Mesh Office Chair — Adjustable", descriptionFallback],
  ];
  const insertKwame = db.prepare(
    `INSERT INTO listings (user_id, category, subcategory, title, description, price, condition, location, region, status, featured, listing_type, emoji, color, views, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?, datetime('now', ?))`
  );
  const res1 = insertKwame.run(kwame, "electronics", "Phones", kwameListings[0][0], kwameListings[0][1], 3200, "Used", "Madina, Accra", "Greater Accra", "product", "📱", "#2563EB", 148, "-2 days");
  const res2 = insertKwame.run(kwame, "home", "Furniture", kwameListings[1][0], kwameListings[1][1], 650, "Like new", "Madina, Accra", "Greater Accra", "product", "🪑", "#0D9488", 62, "-6 days");
  const kwameListing1 = Number(res1.lastInsertRowid);

  // Demo favourite for Kwame
  const fav = db.prepare("INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)");
  fav.run(kwame, 1);
  fav.run(kwame, 11);

  // Demo offer FROM Kwame on the Corolla
  db.prepare(
    `INSERT INTO offers (listing_id, buyer_id, amount, message, status) VALUES (?, ?, ?, ?, 'pending')`
  ).run(7, kwame, 130000, "Hello, I'm interested in the Corolla. Can you do GH₵130,000 if I inspect this week?");

  // Demo offer TO Kwame on his iPhone
  const kofib = userIds.get("kofib")!;
  db.prepare(
    `INSERT INTO offers (listing_id, buyer_id, amount, message, status) VALUES (?, ?, ?, ?, 'pending')`
  ).run(kwameListing1, kofib, 2900, "Bro, GH₵2,900 and I'll pick it up today from Madina.");
  void res2;
}

export function getDatabase(): DatabaseSync {
  const db = getDb();
  seed(db);
  ensureDemoAdmin(db);
  return db;
}

/** The original demo account doubles as the administrator so the admin
 *  console has a working first user. New sign-ups are always role 'user'. */
function ensureDemoAdmin(db: DatabaseSync) {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = 1").run();
}

/* ---------------- Queries ---------------- */

export function getUsers(): User[] {
  return getDatabase().prepare("SELECT * FROM users ORDER BY name").all() as unknown as User[];
}

export function getCategories() {
  return CATEGORIES;
}

export function getFeaturedListings(): Listing[] {
  return getDatabase()
    .prepare("SELECT * FROM listings WHERE status = 'active' AND featured = 1 ORDER BY created_at DESC")
    .all() as unknown as Listing[];
}

export function getRecentListings(limit = 8): Listing[] {
  return getDatabase()
    .prepare("SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT ?")
    .all(limit) as unknown as Listing[];
}

export type SearchFilters = {
  q?: string;
  category?: string;
  region?: string;
  min?: number;
  max?: number;
  condition?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
};

export function searchListings(f: SearchFilters): Listing[] {
  const db = getDatabase();
  const where: string[] = ["status = 'active'"];
  const params: (string | number)[] = [];
  if (f.q) {
    where.push("(title LIKE ? OR description LIKE ? OR subcategory LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like);
  }
  if (f.category) { where.push("category = ?"); params.push(f.category); }
  if (f.region) { where.push("region = ?"); params.push(f.region); }
  if (f.condition) { where.push("condition = ?"); params.push(f.condition); }
  if (f.min !== undefined && !Number.isNaN(f.min)) { where.push("price >= ?"); params.push(f.min); }
  if (f.max !== undefined && !Number.isNaN(f.max)) { where.push("price <= ?"); params.push(f.max); }
  const order =
    f.sort === "price_asc" ? "price ASC" :
    f.sort === "price_desc" ? "price DESC" :
    f.sort === "popular" ? "views DESC" :
    "created_at DESC";
  return db
    .prepare(`SELECT * FROM listings WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 60`)
    .all(...params) as unknown as Listing[];
}

export function getListing(id: number): (Listing & { seller_name: string; seller_type: string; seller_location: string; seller_joined_at: string; seller_id_verified: number; seller_business_verified: number; seller_completed_deals: number; }) | undefined {
  const db = getDatabase();
  db.prepare("UPDATE listings SET views = views + 1 WHERE id = ?").run(id);
  return db
    .prepare(
      `SELECT l.*, u.name as seller_name, u.account_type as seller_type, u.location as seller_location,
              u.joined_at as seller_joined_at, u.id_verified as seller_id_verified,
              u.business_verified as seller_business_verified,
              (SELECT COUNT(*) FROM deals d WHERE d.seller_id = l.user_id AND d.status = 'settled') as seller_completed_deals
       FROM listings l JOIN users u ON u.id = l.user_id WHERE l.id = ?`
    )
    .get(id) as never;
}

export function getListingsByUser(userId: number): Listing[] {
  return getDatabase()
    .prepare("SELECT * FROM listings WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as unknown as Listing[];
}

export function getFavoriteIds(userId: number): number[] {
  const rows = getDatabase()
    .prepare("SELECT listing_id FROM favorites WHERE user_id = ?")
    .all(userId) as { listing_id: number }[];
  return rows.map((r) => r.listing_id);
}

export function getFavoriteListings(userId: number): Listing[] {
  return getDatabase()
    .prepare(
      `SELECT l.* FROM favorites f JOIN listings l ON l.id = f.listing_id
       WHERE f.user_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId) as unknown as Listing[];
}

export function getOffersForSeller(sellerId: number): (Offer & { listing_title: string; buyer_name: string })[] {
  return getDatabase()
    .prepare(
      `SELECT o.*, l.title as listing_title, u.name as buyer_name
       FROM offers o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = o.buyer_id
       WHERE l.user_id = ? ORDER BY o.created_at DESC`
    )
    .all(sellerId) as never;
}

export function getOffersByBuyer(buyerId: number): (Offer & { listing_title: string; seller_name: string })[] {
  return getDatabase()
    .prepare(
      `SELECT o.*, l.title as listing_title, u.name as seller_name
       FROM offers o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = l.user_id
       WHERE o.buyer_id = ? ORDER BY o.created_at DESC`
    )
    .all(buyerId) as never;
}

export function getDashboardStats(userId: number) {
  const db = getDatabase();
  const listings = (db.prepare("SELECT COUNT(*) c FROM listings WHERE user_id = ?").get(userId) as { c: number }).c;
  const views = (db.prepare("SELECT COALESCE(SUM(views),0) c FROM listings WHERE user_id = ?").get(userId) as { c: number }).c;
  const favorites = (db.prepare(
    "SELECT COUNT(*) c FROM favorites f JOIN listings l ON l.id = f.listing_id WHERE l.user_id = ?"
  ).get(userId) as { c: number }).c;
  const offers = (db.prepare(
    "SELECT COUNT(*) c FROM offers o JOIN listings l ON l.id = o.listing_id WHERE l.user_id = ?"
  ).get(userId) as { c: number }).c;
  return { listings, views, favorites, offers };
}

/* ---------------- Auth: sessions & OTP ---------------- */

export type UserFull = User & {
  role: string;
  account_id: string | null;
  id_verified: number;
  business_verified: number;
};

export function getUserByPhone(phone: string): UserFull | undefined {
  return getDatabase()
    .prepare("SELECT * FROM users WHERE phone = ? OR phone = ?")
    .get(phone, normalizePhone(phone)) as UserFull | undefined;
}

export function getUserByIdFull(id: number): UserFull | undefined {
  return getDatabase().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserFull | undefined;
}

/** Authenticated user from the session cookie, or null when signed out.
 *  Falls back to the original demo account (id 1) so the pre-auth MVP
 *  keeps working for existing pages. */
export function getCurrentUser(): User {
  return getSessionUser() ?? (getDatabase().prepare("SELECT * FROM users WHERE id = 1").get() as unknown as User);
}

/** Session token provider installed by ./auth at request time, so db.ts
 *  stays independent of next/headers and avoids a circular import. */
let sessionTokenProvider: (() => string | undefined) | null = null;
export function setSessionTokenProvider(fn: () => string | undefined) {
  sessionTokenProvider = fn;
}

export function getSessionUser(): UserFull | null {
  const token = sessionTokenProvider?.();
  if (!token) return null;
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT s.user_id FROM sessions s WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as { user_id: number } | undefined;
  if (!row) return null;
  return getUserByIdFull(row.user_id) ?? null;
}

/* ---------------- Photos ---------------- */

export function getListingPhotos(listingId: number): { id: number; filename: string }[] {
  return getDatabase()
    .prepare("SELECT id, filename FROM listing_photos WHERE listing_id = ? ORDER BY position, id")
    .all(listingId) as unknown as { id: number; filename: string }[];
}

export function getPrimaryPhoto(listingIds: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (listingIds.length === 0) return map;
  const placeholders = listingIds.map(() => "?").join(",");
  const rows = getDatabase()
    .prepare(
      `SELECT listing_id, filename FROM listing_photos
       WHERE listing_id IN (${placeholders}) ORDER BY position, id`
    )
    .all(...listingIds) as unknown as { listing_id: number; filename: string }[];
  for (const r of rows) if (!map.has(r.listing_id)) map.set(r.listing_id, r.filename);
  return map;
}

export function getPhotoCounts(listingIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (listingIds.length === 0) return map;
  const placeholders = listingIds.map(() => "?").join(",");
  const rows = getDatabase()
    .prepare(
      `SELECT listing_id, COUNT(*) as c FROM listing_photos
       WHERE listing_id IN (${placeholders}) GROUP BY listing_id`
    )
    .all(...listingIds) as unknown as { listing_id: number; c: number }[];
  for (const r of rows) map.set(r.listing_id, r.c);
  return map;
}

export function addListingPhoto(listingId: number, filename: string): number {
  const res = getDatabase()
    .prepare("INSERT INTO listing_photos (listing_id, filename, position) VALUES (?, ?, (SELECT COALESCE(MAX(position),0)+1 FROM listing_photos WHERE listing_id = ?))")
    .run(listingId, filename, listingId);
  return Number(res.lastInsertRowid);
}

/* ---------------- Chat / messages ---------------- */

export type ChatMessage = {
  id: number;
  listing_id: number;
  from_user_id: number;
  to_user_id: number;
  body: string;
  created_at: string;
  from_name: string;
};

export function getMessagesForListing(listingId: number, userId: number): ChatMessage[] {
  return getDatabase()
    .prepare(
      `SELECT m.*, u.name as from_name FROM messages m JOIN users u ON u.id = m.from_user_id
       WHERE m.listing_id = ? AND (m.from_user_id = ? OR m.to_user_id = ?)
       ORDER BY m.id ASC LIMIT 200`
    )
    .all(listingId, userId, userId) as unknown as ChatMessage[];
}

export function insertMessage(listingId: number, fromUserId: number, toUserId: number, body: string): number {
  const res = getDatabase()
    .prepare("INSERT INTO messages (listing_id, from_user_id, to_user_id, body) VALUES (?, ?, ?, ?)")
    .run(listingId, fromUserId, toUserId, body);
  return Number(res.lastInsertRowid);
}

export type InboxThread = {
  listing_id: number;
  listing_title: string;
  other_user_id: number;
  other_name: string;
  last_body: string;
  last_at: string;
  unread: number;
};

export function getInboxThreads(userId: number): InboxThread[] {
  return getDatabase()
    .prepare(
      `WITH partners AS (
         SELECT listing_id,
                CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS other_user_id
         FROM messages WHERE from_user_id = ? OR to_user_id = ?
       ),
       distinct_threads AS (
         SELECT listing_id, other_user_id FROM partners GROUP BY listing_id, other_user_id
       )
       SELECT t.listing_id,
              l.title as listing_title,
              t.other_user_id,
              ou.name as other_name,
              (SELECT body FROM messages m WHERE m.listing_id = t.listing_id
                 AND ((m.from_user_id = t.other_user_id AND m.to_user_id = ?)
                   OR (m.from_user_id = ? AND m.to_user_id = t.other_user_id))
               ORDER BY m.id DESC LIMIT 1) as last_body,
              (SELECT created_at FROM messages m WHERE m.listing_id = t.listing_id
                 AND ((m.from_user_id = t.other_user_id AND m.to_user_id = ?)
                   OR (m.from_user_id = ? AND m.to_user_id = t.other_user_id))
               ORDER BY m.id DESC LIMIT 1) as last_at,
              (SELECT COUNT(*) FROM messages m WHERE m.listing_id = t.listing_id
                 AND m.to_user_id = ? AND m.read_at IS NULL) as unread
       FROM distinct_threads t
       JOIN listings l ON l.id = t.listing_id
       JOIN users ou ON ou.id = t.other_user_id
       ORDER BY last_at DESC`
    )
    .all(userId, userId, userId, userId, userId, userId, userId, userId) as unknown as InboxThread[];
}

export function markThreadRead(listingId: number, userId: number) {
  getDatabase()
    .prepare("UPDATE messages SET read_at = datetime('now') WHERE listing_id = ? AND to_user_id = ? AND read_at IS NULL")
    .run(listingId, userId);
}

export function countUnreadMessages(userId: number): number {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) c FROM messages WHERE to_user_id = ? AND read_at IS NULL")
    .get(userId) as { c: number };
  return row.c;
}

/* ---------------- Admin / moderation ---------------- */

export function getPendingListings(): (Listing & { seller_name: string })[] {
  return getDatabase()
    .prepare(
      `SELECT l.*, u.name as seller_name FROM listings l JOIN users u ON u.id = l.user_id
       WHERE l.status = 'pending' ORDER BY l.created_at ASC`
    )
    .all() as unknown as (Listing & { seller_name: string })[];
}

export function setListingFeatured(listingId: number, featured: 0 | 1) {
  getDatabase().prepare("UPDATE listings SET featured = ? WHERE id = ?").run(featured, listingId);
}

export function getAdminStats() {
  const db = getDatabase();
  const pending = (db.prepare("SELECT COUNT(*) c FROM listings WHERE status = 'pending'").get() as { c: number }).c;
  const active = (db.prepare("SELECT COUNT(*) c FROM listings WHERE status = 'active'").get() as { c: number }).c;
  const users = (db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;
  const views = (db.prepare("SELECT COALESCE(SUM(views),0) c FROM listings").get() as { c: number }).c;
  return { pending, active, users, views };
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00233")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`;
  if (digits.length === 9) return `+233${digits}`;
  return `+${digits}`;
}
