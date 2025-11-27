import dotenv from 'dotenv';
import DatabaseConnection from './connection';
import { UserModel } from './models';
import { hashPassword } from '../utils/password.util';

dotenv.config();

/**
 * Seed admin user
 * Email: lyvinhthai321@gmail.com
 * Password: Admin@123
 */
async function seedAdminUser() {
  try {
    console.log('🌱 Starting admin user seed...');

    // Connect to database
    await DatabaseConnection.connect();

    // Check if admin user already exists
    const existingAdmin = await UserModel.findOne({ email: 'lyvinhthai321@gmail.com' });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   2FA Enabled:', existingAdmin.twoFactorEnabled);
      await DatabaseConnection.disconnect();
      return;
    }

    // Create admin user
    const passwordHash = await hashPassword('Admin@123');

    const adminUser = await UserModel.create({
      email: 'lyvinhthai321@gmail.com',
      passwordHash,
      role: 'admin',
      enabled: true,
      twoFactorEnabled: false,
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email:', adminUser.email);
    console.log('   Password: Admin@123');
    console.log('   Role:', adminUser.role);
    console.log('\n⚠️  IMPORTANT:');
    console.log('   1. Login with the above credentials');
    console.log('   2. Setup 2FA (Google Authenticator) on first login');
    console.log('   3. Change your password after first login');

    await DatabaseConnection.disconnect();
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  }
}

// Run seed
seedAdminUser()
  .then(() => {
    console.log('\n✨ Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
