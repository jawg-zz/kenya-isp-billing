import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@isp-kenya.co.ke' },
    update: {
      password: adminPassword,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
    },
    create: {
      email: 'admin@isp-kenya.co.ke',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+254700000001',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
    },
  });

  console.log('Admin user created:', admin.email);

  // Create demo plans
  const plans = [
    {
      name: 'Daily Starter',
      code: 'DAILY-STARTER',
      description: 'Perfect for light users who need internet for a day',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 50,
      dataAllowance: 500 * 1024 * 1024, // 500MB
      speedLimit: 2,
      validityDays: 1,
      fupThreshold: 400 * 1024 * 1024,
      fupSpeedLimit: 1,
      isFeatured: false,
      sortOrder: 1,
    },
    {
      name: 'Daily Heavy',
      code: 'DAILY-HEAVY',
      description: 'For heavy users who need reliable all-day internet',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 150,
      dataAllowance: 2 * 1024 * 1024 * 1024, // 2GB
      speedLimit: 5,
      validityDays: 1,
      fupThreshold: 1500 * 1024 * 1024,
      fupSpeedLimit: 2,
      isFeatured: false,
      sortOrder: 2,
    },
    {
      name: 'Weekly Basic',
      code: 'WEEKLY-BASIC',
      description: 'Great value weekly plan for regular browsing',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 299,
      dataAllowance: 3 * 1024 * 1024 * 1024, // 3GB
      speedLimit: 4,
      validityDays: 7,
      fupThreshold: 2500 * 1024 * 1024,
      fupSpeedLimit: 1,
      isFeatured: true,
      sortOrder: 3,
    },
    {
      name: 'Weekly Premium',
      code: 'WEEKLY-PREMIUM',
      description: 'High-speed internet for the entire week',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 599,
      dataAllowance: 10 * 1024 * 1024 * 1024, // 10GB
      speedLimit: 10,
      validityDays: 7,
      fupThreshold: 8 * 1024 * 1024 * 1024,
      fupSpeedLimit: 4,
      isFeatured: true,
      sortOrder: 4,
    },
    {
      name: 'Monthly Starter',
      code: 'MONTHLY-STARTER',
      description: 'Affordable monthly internet for casual users',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 999,
      dataAllowance: 15 * 1024 * 1024 * 1024, // 15GB
      speedLimit: 5,
      validityDays: 30,
      fupThreshold: 12 * 1024 * 1024 * 1024,
      fupSpeedLimit: 2,
      isFeatured: true,
      sortOrder: 5,
    },
    {
      name: 'Monthly Standard',
      code: 'MONTHLY-STANDARD',
      description: 'Perfect for families and regular internet users',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 2499,
      dataAllowance: 40 * 1024 * 1024 * 1024, // 40GB
      speedLimit: 10,
      validityDays: 30,
      fupThreshold: 30 * 1024 * 1024 * 1024,
      fupSpeedLimit: 4,
      isFeatured: true,
      sortOrder: 6,
    },
    {
      name: 'Monthly Premium',
      code: 'MONTHLY-PREMIUM',
      description: 'Unlimited high-speed internet for power users',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 4999,
      dataAllowance: 100 * 1024 * 1024 * 1024, // 100GB
      speedLimit: 25,
      validityDays: 30,
      fupThreshold: 80 * 1024 * 1024 * 1024,
      fupSpeedLimit: 10,
      isFeatured: true,
      sortOrder: 7,
    },
    {
      name: 'Monthly Unlimited',
      code: 'MONTHLY-UNLIMITED',
      description: 'Truly unlimited internet with no caps',
      type: 'PREPAID',
      dataType: 'DATA',
      price: 7999,
      dataAllowance: null, // Unlimited
      speedLimit: 50,
      validityDays: 30,
      fupThreshold: null,
      fupSpeedLimit: null,
      isFeatured: true,
      sortOrder: 8,
    },
    {
      name: 'Corporate Basic',
      code: 'CORP-BASIC',
      description: 'Postpaid plan for small businesses',
      type: 'POSTPAID',
      dataType: 'DATA',
      price: 5000,
      dataAllowance: 100 * 1024 * 1024 * 1024, // 100GB
      speedLimit: 25,
      billingCycle: 'MONTHLY',
      validityDays: 30,
      fupThreshold: 80 * 1024 * 1024 * 1024,
      fupSpeedLimit: 10,
      isFeatured: false,
      sortOrder: 9,
    },
    {
      name: 'Corporate Premium',
      code: 'CORP-PREMIUM',
      description: 'Dedicated bandwidth for medium businesses',
      type: 'POSTPAID',
      dataType: 'DATA',
      price: 15000,
      dataAllowance: null, // Unlimited
      speedLimit: 100,
      billingCycle: 'MONTHLY',
      validityDays: 30,
      fupThreshold: null,
      fupSpeedLimit: null,
      isFeatured: false,
      sortOrder: 10,
    },
    {
      name: 'Corporate Enterprise',
      code: 'CORP-ENTERPRISE',
      description: 'Enterprise-grade dedicated internet',
      type: 'POSTPAID',
      dataType: 'DATA',
      price: 50000,
      dataAllowance: null, // Unlimited
      speedLimit: 250,
      billingCycle: 'MONTHLY',
      validityDays: 30,
      fupThreshold: null,
      fupSpeedLimit: null,
      isFeatured: false,
      sortOrder: 11,
    },
  ];

  for (const planData of plans) {
    const plan = await prisma.plan.upsert({
      where: { code: planData.code },
      update: {},
      create: {
        ...planData,
        type: planData.type as 'PREPAID' | 'POSTPAID',
        dataType: planData.dataType as 'DATA' | 'VOICE' | 'SMS' | 'BUNDLE',
        billingCycle: planData.billingCycle as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | undefined,
        isActive: true,
        metadata: {
          features: getPlanFeatures(planData.code),
        },
      },
    });

    // Create plan prices for each billing cycle
    if (planData.type === 'POSTPAID') {
      const priceMultiplier: Record<string, number> = {
        WEEKLY: 0.3,
        MONTHLY: 1,
        QUARTERLY: 2.8,
        YEARLY: 10,
      };

      for (const [cycle, multiplier] of Object.entries(priceMultiplier)) {
        await prisma.planPrice.upsert({
          where: {
            planId_billingCycle: {
              planId: plan.id,
              billingCycle: cycle as any,
            },
          },
          update: {},
          create: {
            planId: plan.id,
            billingCycle: cycle as any,
            price: planData.price * multiplier,
          },
        });
      }
    }

    console.log(`Plan created: ${plan.name}`);
  }

  // Create system settings
  const settings = [
    { key: 'company_name', value: 'Kenya ISP Limited', category: 'company' },
    { key: 'company_email', value: 'info@kenyaisp.co.ke', category: 'company' },
    { key: 'company_phone', value: '+254 700 000000', category: 'company' },
    { key: 'company_address', value: 'P.O. Box 12345, Nairobi, Kenya', category: 'company' },
    { key: 'mpesa_enabled', value: 'true', category: 'payment' },
    { key: 'airtel_enabled', value: 'true', category: 'payment' },
    { key: 'tax_rate', value: '0.16', category: 'billing' },
    { key: 'tax_name', value: 'VAT', category: 'billing' },
    { key: 'grace_period_days', value: '3', category: 'billing' },
    { key: 'fup_enabled', value: 'true', category: 'billing' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('System settings created');

  // Create demo customer
  const customerPassword = await bcrypt.hash('Customer@123', 12);
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@customer.co.ke' },
    update: {
      password: customerPassword,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
    },
    create: {
      email: 'demo@customer.co.ke',
      password: customerPassword,
      firstName: 'John',
      lastName: 'Kamau',
      phone: '+254712345678',
      role: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
      county: 'Nairobi',
      city: 'Nairobi',
      addressLine1: 'Kenyatta Avenue',
    },
  });

  await prisma.customer.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      customerCode: 'CUSTDEMO001',
      accountNumber: 'ACC00DEMO1',
      balance: 1000,
      creditLimit: 5000,
    },
  });

  console.log('Demo customer created:', demoUser.email);

  console.log('Seed completed successfully!');
}

function getPlanFeatures(code: string): string[] {
  const features: string[] = [];
  
  if (code.includes('UNLIMITED')) {
    features.push('Unlimited Data', 'Priority Support', 'Static IP Available');
  } else if (code.includes('PREMIUM')) {
    features.push('High Speed', '24/7 Support', 'Free Router Setup');
  } else if (code.includes('STANDARD')) {
    features.push('Good Speed', 'Email Support');
  } else if (code.includes('STARTER')) {
    features.push('Basic Internet', 'WhatsApp & Social Media');
  }

  if (code.includes('CORP')) {
    features.push('Business Hours Support', 'SLA Guaranteed', 'Dedicated Account Manager');
  }

  return features;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
