const fs = require('fs');
const path = require('path');

// Enums
const Role = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  KITCHEN: 'KITCHEN',
  ADMIN: 'ADMIN'
};

const SessionStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED'
};

const OrderStatus = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  CANCELLED: 'CANCELLED'
};

const SenderType = {
  USER: 'USER',
  AI: 'AI'
};

// In-Memory Database Arrays
let users = [
  { id: 'usr_aarav', name: 'Aarav Mehta', email: 'aarav@gmail.com', role: Role.CUSTOMER, createdAt: new Date(), updatedAt: new Date() },
  { id: 'usr_rajesh', name: 'Rajesh Kumar', email: 'rajesh@smartdining.com', role: Role.STAFF, createdAt: new Date(), updatedAt: new Date() },
  { id: 'usr_harpal', name: 'Chef Harpal', email: 'harpal@smartdining.com', role: Role.KITCHEN, createdAt: new Date(), updatedAt: new Date() },
  { id: 'usr_sonia', name: 'Sonia Sharma', email: 'admin@smartdining.com', role: Role.ADMIN, createdAt: new Date(), updatedAt: new Date() }
];

let menuItems = [
  {
    id: 'item_paneer_tikka',
    name: 'Paneer Tikka Angare',
    category: 'Appetizers',
    price: 345.0,
    description: 'Cubes of fresh cottage cheese marinated in a fierce blend of Kashmiri spices, hung curd, and mustard oil, chargrilled in the clay oven.',
    imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Spicy', 'Tandoor', 'Best Seller'],
    allergens: ['Dairy'],
    available: true,
    popularScore: 92,
    complementaryItems: ['Garlic Naan', 'Mint Chutney Extra', 'Mango Lassi'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_hara_bhara',
    name: 'Hara Bhara Kebab',
    category: 'Appetizers',
    price: 285.0,
    description: 'Delicate pan-fried patties made of minced spinach, green peas, and mashed potatoes, flavored with royal spices and stuffed with cashew nuts.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Healthy', 'Gluten-Free Option'],
    allergens: ['Nuts'],
    available: true,
    popularScore: 78,
    complementaryItems: ['Mint Chutney Extra', 'Fresh Lime Soda'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_murgh_malai',
    name: 'Murgh Malai Tikka',
    category: 'Appetizers',
    price: 425.0,
    description: 'Boneless chicken chunks marinated in cream, cheese, cardamom, and green chilies, roasted to golden perfection in the tandoor.',
    imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
    tags: ['Non-Vegetarian', 'Mild', 'Tandoor', 'Chef Special'],
    allergens: ['Dairy', 'Nuts'],
    available: true,
    popularScore: 88,
    complementaryItems: ['Butter Naan', 'Masala Chai', 'Mint Chutney Extra'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_samosa_chaat',
    name: 'Samosa Chaat Royale',
    category: 'Appetizers',
    price: 220.0,
    description: 'Crisp savory pastries stuffed with spiced potatoes and peas, crushed and topped with tangy chickpea curry, sweetened yogurt, mint and tamarind chutneys.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Sweet & Tangy', 'Street Food'],
    allergens: ['Dairy', 'Gluten'],
    available: true,
    popularScore: 85,
    complementaryItems: ['Masala Chai', 'Fresh Lime Soda'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_paneer_butter',
    name: 'Paneer Butter Masala',
    category: 'Main Course',
    price: 395.0,
    description: 'Soft tandoori cottage cheese cubes simmered in a smooth, rich tomato, cashew nut, and butter gravy, finished with fresh cream and dried fenugreek leaves.',
    imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Rich', 'Classic', 'Best Seller'],
    allergens: ['Dairy', 'Nuts'],
    available: true,
    popularScore: 95,
    complementaryItems: ['Garlic Naan', 'Saffron Pulao', 'Mango Lassi'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_dal_makhani',
    name: 'Dal Makhani Bukhara',
    category: 'Main Course',
    price: 365.0,
    description: 'Whole black lentils, red kidney beans, and split gram slow-cooked on active charcoal embers for 24 hours, heavily enriched with butter and fresh cream.',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Rich', 'Signature Dish'],
    allergens: ['Dairy'],
    available: true,
    popularScore: 98,
    complementaryItems: ['Butter Naan', 'Jeera Rice'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_butter_chicken',
    name: 'Murgh Makhani (Butter Chicken)',
    category: 'Main Course',
    price: 495.0,
    description: 'Classic tandoor-roasted chicken pieces shredded and cooked in a luxurious, mildly spiced tomato and butter gravy, flavored with roasted kasuri methi.',
    imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
    tags: ['Non-Vegetarian', 'Rich', 'Classic', 'Best Seller'],
    allergens: ['Dairy', 'Nuts'],
    available: true,
    popularScore: 97,
    complementaryItems: ['Garlic Naan', 'Saffron Pulao', 'Mango Lassi'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_mutton_biryani',
    name: 'Awadhi Mutton Biryani',
    category: 'Main Course',
    price: 585.0,
    description: 'A fragrant combination of long-grained basmati rice and tender spring lamb, layered with browned onions, saffron, and fresh mint, slow-cooked in "dum" style.',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    tags: ['Non-Vegetarian', 'Spicy', 'Fragrant', 'Dum Cooked'],
    allergens: ['Dairy'],
    available: true,
    popularScore: 94,
    complementaryItems: ['Mint Chutney Extra', 'Mango Lassi'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_garlic_naan',
    name: 'Garlic Naan',
    category: 'Breads & Rice',
    price: 95.0,
    description: 'Leavened fine flour flatbread topped with minced garlic, fresh coriander, and brushed generously with butter, baked in tandoor.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Garlicky', 'Tandoor'],
    allergens: ['Dairy', 'Gluten'],
    available: true,
    popularScore: 90,
    complementaryItems: ['Paneer Butter Masala', 'Murgh Makhani (Butter Chicken)', 'Dal Makhani Bukhara'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_butter_naan',
    name: 'Butter Naan',
    category: 'Breads & Rice',
    price: 85.0,
    description: 'Traditional leavened clay-oven flatbread stretched and cooked to fluffy perfection, glazed with salted butter.',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Classic', 'Tandoor'],
    allergens: ['Dairy', 'Gluten'],
    available: true,
    popularScore: 88,
    complementaryItems: ['Paneer Butter Masala', 'Murgh Makhani (Butter Chicken)', 'Dal Makhani Bukhara'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_saffron_pulao',
    name: 'Saffron Pulao',
    category: 'Breads & Rice',
    price: 185.0,
    description: 'Aromatic basmati rice cooked with premium Kashmiri saffron strands, ghee, and mild whole spices.',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Gluten-Free', 'Aromatic'],
    allergens: ['Dairy'],
    available: true,
    popularScore: 75,
    complementaryItems: ['Paneer Butter Masala', 'Murgh Makhani (Butter Chicken)'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_rasmalai',
    name: 'Kesari Rasmalai',
    category: 'Desserts',
    price: 185.0,
    description: 'Soft flattened poached cottage cheese dumplings soaked in rich, saffron-flavored sweetened milk, garnished with pistachio and almond flakes.',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Sweet', 'Cold', 'Premium'],
    allergens: ['Dairy', 'Nuts'],
    available: true,
    popularScore: 89,
    complementaryItems: ['Masala Chai'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_gulab_jamun',
    name: 'Shahi Gulab Jamun with Rabri',
    category: 'Desserts',
    price: 195.0,
    description: 'Deep-fried golden milk-solid dumplings, served hot in cardamom-infused sugar syrup, layered over cold, reduced creamy milk (Rabri).',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Sweet', 'Hot & Cold Duo'],
    allergens: ['Dairy', 'Nuts', 'Gluten'],
    available: true,
    popularScore: 91,
    complementaryItems: ['Masala Chai'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_mango_lassi',
    name: 'Royal Mango Lassi',
    category: 'Beverages',
    price: 145.0,
    description: 'A rich and creamy churned yogurt shake sweetened with premium Alphonso mango pulp and garnished with saffron strands.',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Cold', 'Refreshing', 'Best Seller'],
    allergens: ['Dairy'],
    available: true,
    popularScore: 96,
    complementaryItems: ['Paneer Tikka Angare', 'Murgh Malai Tikka'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_masala_chai',
    name: 'Spiced Masala Chai',
    category: 'Beverages',
    price: 80.0,
    description: 'A comforting rich brew of CTC black tea leaves simmered with whole milk, crushed ginger, cardamom, cloves, and cinnamon.',
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Hot', 'Traditional'],
    allergens: ['Dairy'],
    available: true,
    popularScore: 85,
    complementaryItems: ['Samosa Chaat Royale', 'Kesari Rasmalai'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item_lime_soda',
    name: 'Fresh Lime Soda (Nimbu Shansh)',
    category: 'Beverages',
    price: 110.0,
    description: 'Zesty fresh lime juice mixed with chilled sparkling soda, customizable with sugar, pink salt, or a blend of both (mixed).',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    tags: ['Vegetarian', 'Vegan', 'Cold', 'Refreshing'],
    allergens: [],
    available: true,
    popularScore: 80,
    complementaryItems: ['Hara Bhara Kebab', 'Paneer Tikka Angare'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let sessions = [
  {
    id: 'sess_sample5',
    tableNo: '05',
    userId: 'usr_aarav',
    status: SessionStatus.ACTIVE,
    preferences: '{"spiceLevel":"spicy","allergies":[]}',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let cartItems = [];

let orders = [
  {
    id: 'ord_sample',
    sessionId: 'sess_sample5',
    userId: 'usr_aarav',
    status: OrderStatus.PREPARING,
    totalAmount: 935.0,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let orderItems = [
  { id: 'oi_1', orderId: 'ord_sample', menuItemId: 'item_paneer_butter', quantity: 1, price: 395.0, notes: 'Less spicy please', createdAt: new Date(), updatedAt: new Date() },
  { id: 'oi_2', orderId: 'ord_sample', menuItemId: 'item_dal_makhani', quantity: 1, price: 365.0, notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'oi_3', orderId: 'ord_sample', menuItemId: 'item_garlic_naan', quantity: 2, price: 95.0, notes: null, createdAt: new Date(), updatedAt: new Date() }
];

let aiMessages = [
  { id: 'msg_1', sessionId: 'sess_sample5', sender: SenderType.USER, text: 'Hi, what starters do you recommend that are spicy and vegetarian?', createdAt: new Date(Date.now() - 60000) },
  { id: 'msg_2', sessionId: 'sess_sample5', sender: SenderType.AI, text: 'Hello! I highly recommend our **Paneer Tikka Angare** (₹345). It features fresh cottage cheese chunks marinated in fiery Kashmiri chilies, hung curd, and mustard oil, chargrilled to smoky perfection. Pair it with our refreshing **Royal Mango Lassi** to balance the heat!', createdAt: new Date() }
];

// Helper to generate IDs
function genId(prefix = 'cuid') {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

class PrismaClient {
  constructor() {
    console.log('[PrismaMock] Initialized In-Memory Database Server');
  }

  async $connect() {
    // No-op
  }

  async $disconnect() {
    // No-op
  }

  // Model Operations
  get user() {
    return {
      findMany: async () => {
        return [...users];
      },
      findUnique: async ({ where }) => {
        return users.find(u => u.id === where.id || u.email === where.email) || null;
      },
      create: async ({ data }) => {
        const user = { id: data.id || genId('usr'), ...data, createdAt: new Date(), updatedAt: new Date() };
        users.push(user);
        return user;
      },
      deleteMany: async () => {
        users = [];
        return { count: 0 };
      }
    };
  }

  get menuItem() {
    return {
      findMany: async (args = {}) => {
        let list = [...menuItems];
        if (args.where) {
          if (args.where.available !== undefined) {
            list = list.filter(item => item.available === args.where.available);
          }
        }
        if (args.orderBy) {
          if (args.orderBy.popularScore === 'desc') {
            list.sort((a, b) => b.popularScore - a.popularScore);
          }
        }
        return list;
      },
      findUnique: async ({ where }) => {
        return menuItems.find(item => item.id === where.id) || null;
      },
      create: async ({ data }) => {
        const item = { id: data.id || genId('item'), ...data, createdAt: new Date(), updatedAt: new Date() };
        menuItems.push(item);
        return item;
      },
      update: async ({ where, data }) => {
        const idx = menuItems.findIndex(item => item.id === where.id);
        if (idx !== -1) {
          menuItems[idx] = { ...menuItems[idx], ...data, updatedAt: new Date() };
          return menuItems[idx];
        }
        throw new Error(`MenuItem not found: ${where.id}`);
      },
      deleteMany: async () => {
        menuItems = [];
        return { count: 0 };
      }
    };
  }

  get session() {
    return {
      findFirst: async ({ where }) => {
        return sessions.find(s => {
          let matches = true;
          if (where.tableNo !== undefined) matches = matches && s.tableNo === where.tableNo;
          if (where.status !== undefined) matches = matches && s.status === where.status;
          return matches;
        }) || null;
      },
      findUnique: async ({ where, include }) => {
        const session = sessions.find(s => s.id === where.id) || null;
        if (session && include && include.user) {
          const userObj = users.find(u => u.id === session.userId) || null;
          return { ...session, user: userObj };
        }
        return session;
      },
      create: async ({ data }) => {
        const s = {
          id: genId('sess'),
          tableNo: data.tableNo,
          userId: data.userId || null,
          status: data.status || SessionStatus.ACTIVE,
          preferences: data.preferences || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        sessions.push(s);
        return s;
      },
      update: async ({ where, data }) => {
        const idx = sessions.findIndex(s => s.id === where.id);
        if (idx !== -1) {
          sessions[idx] = { ...sessions[idx], ...data, updatedAt: new Date() };
          return sessions[idx];
        }
        throw new Error(`Session not found: ${where.id}`);
      },
      deleteMany: async () => {
        sessions = [];
        return { count: 0 };
      }
    };
  }

  get cartItem() {
    return {
      findMany: async ({ where, include }) => {
        let list = cartItems.filter(c => c.sessionId === where.sessionId);
        if (include && include.menuItem) {
          list = list.map(c => ({
            ...c,
            menuItem: menuItems.find(m => m.id === c.menuItemId) || null
          }));
        }
        return list;
      },
      findFirst: async ({ where }) => {
        return cartItems.find(c => c.sessionId === where.sessionId && c.menuItemId === where.menuItemId) || null;
      },
      create: async ({ data, include }) => {
        const c = {
          id: genId('cart'),
          sessionId: data.sessionId,
          menuItemId: data.menuItemId,
          quantity: data.quantity || 1,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        cartItems.push(c);
        if (include && include.menuItem) {
          return { ...c, menuItem: menuItems.find(m => m.id === c.menuItemId) || null };
        }
        return c;
      },
      update: async ({ where, data, include }) => {
        const idx = cartItems.findIndex(c => c.id === where.id);
        if (idx !== -1) {
          cartItems[idx] = { ...cartItems[idx], ...data, updatedAt: new Date() };
          if (include && include.menuItem) {
            return { ...cartItems[idx], menuItem: menuItems.find(m => m.id === cartItems[idx].menuItemId) || null };
          }
          return cartItems[idx];
        }
        throw new Error(`CartItem not found: ${where.id}`);
      },
      delete: async ({ where }) => {
        cartItems = cartItems.filter(c => c.id !== where.id);
        return { success: true };
      },
      deleteMany: async ({ where } = {}) => {
        if (where && where.sessionId) {
          cartItems = cartItems.filter(c => c.sessionId !== where.sessionId);
        } else {
          cartItems = [];
        }
        return { count: 0 };
      }
    };
  }

  get order() {
    return {
      create: async ({ data, include }) => {
        const o = {
          id: genId('ord'),
          sessionId: data.sessionId,
          userId: data.userId || null,
          status: data.status || OrderStatus.PENDING,
          totalAmount: data.totalAmount,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        orders.push(o);

        // Handle items create relation
        let createdOis = [];
        if (data.items && data.items.create) {
          data.items.create.forEach(item => {
            const oi = {
              id: genId('oi'),
              orderId: o.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes || null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            orderItems.push(oi);
            createdOis.push({
              ...oi,
              menuItem: menuItems.find(m => m.id === item.menuItemId) || null
            });
          });
        }

        if (include && include.items) {
          return { ...o, items: createdOis };
        }
        return o;
      },
      findMany: async ({ where, include, orderBy } = {}) => {
        let list = [...orders];
        if (where) {
          if (where.sessionId !== undefined) {
            list = list.filter(o => o.sessionId === where.sessionId);
          }
        }
        if (include) {
          list = list.map(o => {
            let res = { ...o };
            if (include.session) {
              res.session = sessions.find(s => s.id === o.sessionId) || null;
            }
            if (include.items) {
              let ois = orderItems.filter(oi => oi.orderId === o.id);
              if (include.items.include && include.items.include.menuItem) {
                ois = ois.map(oi => ({
                  ...oi,
                  menuItem: menuItems.find(m => m.id === oi.menuItemId) || null
                }));
              }
              res.items = ois;
            }
            return res;
          });
        }
        if (orderBy && orderBy.createdAt === 'desc') {
          list.sort((a, b) => b.createdAt - a.createdAt);
        }
        return list;
      },
      update: async ({ where, data, include }) => {
        const idx = orders.findIndex(o => o.id === where.id);
        if (idx !== -1) {
          orders[idx] = { ...orders[idx], ...data, updatedAt: new Date() };
          let res = { ...orders[idx] };
          if (include && include.session) {
            res.session = sessions.find(s => s.id === res.sessionId) || null;
          }
          return res;
        }
        throw new Error(`Order not found: ${where.id}`);
      },
      deleteMany: async () => {
        orders = [];
        return { count: 0 };
      }
    };
  }

  get orderItem() {
    return {
      create: async ({ data }) => {
        const oi = {
          id: genId('oi'),
          orderId: data.orderId,
          menuItemId: data.menuItemId,
          quantity: data.quantity,
          price: data.price,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        orderItems.push(oi);
        return oi;
      },
      deleteMany: async () => {
        orderItems = [];
        return { count: 0 };
      }
    };
  }

  get aiMessage() {
    return {
      create: async ({ data }) => {
        const msg = {
          id: genId('msg'),
          sessionId: data.sessionId,
          sender: data.sender,
          text: data.text,
          createdAt: new Date()
        };
        aiMessages.push(msg);
        return msg;
      },
      createMany: async ({ data }) => {
        data.forEach(item => {
          aiMessages.push({
            id: genId('msg'),
            sessionId: item.sessionId,
            sender: item.sender,
            text: item.text,
            createdAt: new Date()
          });
        });
        return { count: data.length };
      },
      findMany: async ({ where, orderBy, take } = {}) => {
        let list = aiMessages.filter(msg => msg.sessionId === where.sessionId);
        if (orderBy && orderBy.createdAt === 'desc') {
          list.sort((a, b) => b.createdAt - a.createdAt);
        } else {
          list.sort((a, b) => a.createdAt - b.createdAt);
        }
        if (take !== undefined) {
          list = list.slice(0, take);
        }
        return list;
      },
      deleteMany: async () => {
        aiMessages = [];
        return { count: 0 };
      }
    };
  }
}

// Exports exactly matching Prisma client structure
exports.PrismaClient = PrismaClient;
exports.Role = Role;
exports.SessionStatus = SessionStatus;
exports.OrderStatus = OrderStatus;
exports.SenderType = SenderType;
exports.$Enums = { Role, SessionStatus, OrderStatus, SenderType };
exports.Prisma = {
  PrismaClientKnownRequestError: class extends Error {},
  PrismaClientUnknownRequestError: class extends Error {},
  PrismaClientRustPanicError: class extends Error {},
  PrismaClientInitializationError: class extends Error {},
  PrismaClientValidationError: class extends Error {}
};
