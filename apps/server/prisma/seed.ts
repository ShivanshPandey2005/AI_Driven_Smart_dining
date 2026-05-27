import { PrismaClient, Role, SessionStatus, OrderStatus, SenderType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing database contents...');
  await prisma.aiMessage.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding standard users...');
  const customer = await prisma.user.create({
    data: {
      name: 'Aarav Mehta',
      email: 'aarav@gmail.com',
      role: Role.CUSTOMER,
    },
  });

  const waiter = await prisma.user.create({
    data: {
      name: 'Rajesh Kumar',
      email: 'rajesh@smartdining.com',
      role: Role.STAFF,
    },
  });

  const kitchen = await prisma.user.create({
    data: {
      name: 'Chef Harpal',
      email: 'harpal@smartdining.com',
      role: Role.KITCHEN,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Sonia Sharma',
      email: 'admin@smartdining.com',
      role: Role.ADMIN,
    },
  });

  console.log('Seeding premium Indian restaurant menu items...');
  const menuItemsData = [
    // --- Appetizers ---
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },

    // --- Main Course ---
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },

    // --- Breads & Rice ---
    {
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
    },
    {
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
    },
    {
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
    },

    // --- Desserts ---
    {
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
    },
    {
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
    },

    // --- Beverages ---
    {
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
    },
    {
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
    },
    {
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
    },
  ];

  const insertedItems = [];
  for (const item of menuItemsData) {
    const createdItem = await prisma.menuItem.create({
      data: item,
    });
    insertedItems.push(createdItem);
  }
  console.log(`Seeded ${insertedItems.length} menu items successfully.`);

  console.log('Seeding a live sample session and order...');
  // Create an active session at Table 5 for customer Aarav
  const activeSession = await prisma.session.create({
    data: {
      tableNo: '05',
      userId: customer.id,
      status: SessionStatus.ACTIVE,
    },
  });

  // Create an order in that session
  const order = await prisma.order.create({
    data: {
      sessionId: activeSession.id,
      userId: customer.id,
      status: OrderStatus.PREPARING,
      totalAmount: 935.0, // Paneer Butter Masala (395) + Dal Makhani (365) + 2x Garlic Naan (190) + 1x Lassi (145) = 1095 - let's make it match
    },
  });

  const paneerMasala = insertedItems.find((i) => i.name === 'Paneer Butter Masala');
  const dalMakhani = insertedItems.find((i) => i.name === 'Dal Makhani Bukhara');
  const garlicNaan = insertedItems.find((i) => i.name === 'Garlic Naan');

  if (paneerMasala && dalMakhani && garlicNaan) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: paneerMasala.id,
        quantity: 1,
        price: paneerMasala.price,
        notes: 'Less spicy please',
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: dalMakhani.id,
        quantity: 1,
        price: dalMakhani.price,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: garlicNaan.id,
        quantity: 2,
        price: garlicNaan.price,
      },
    });
  }

  // Create some initial chat history for AI memory demonstration
  await prisma.aiMessage.createMany({
    data: [
      {
        sessionId: activeSession.id,
        sender: SenderType.USER,
        text: 'Hi, what starters do you recommend that are spicy and vegetarian?',
      },
      {
        sessionId: activeSession.id,
        sender: SenderType.AI,
        text: 'Hello! I highly recommend our **Paneer Tikka Angare** (₹345). It features fresh cottage cheese chunks marinated in fiery Kashmiri chilies, hung curd, and mustard oil, chargrilled to smoky perfection. Pair it with our refreshing **Royal Mango Lassi** to balance the heat!',
      },
    ],
  });

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
