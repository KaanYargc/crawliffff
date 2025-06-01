// This is a one-time script to fix user first_login flag
import DB from './db';

async function fixUserFirstLoginFlag() {
  try {
    console.log('Starting user account fix script...');
    
    // Initialize database
    DB.init();
    
    // Update specific user by email
    const email = 'onurkonuk174@gmail.com';
    
    // First check if user exists
    const user = await DB.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }
    
    console.log('Current user state:', {
      id: user.id,
      email: user.email,
      package: user.package,
      first_login: user.first_login
    });
    
    // Update first_login flag to false
    const result = await DB.run(
      'UPDATE users SET first_login = 0 WHERE email = ?',
      [email]
    );
    
    if (result.changes === 0) {
      console.error('Update failed: No rows were affected');
      return;
    }
    
    // Verify the update worked
    const updatedUser = await DB.get('SELECT * FROM users WHERE email = ?', [email]);
    
    console.log('User updated successfully:', {
      id: updatedUser.id,
      email: updatedUser.email,
      package: updatedUser.package,
      first_login: updatedUser.first_login
    });
    
    console.log('✅ User first_login flag has been set to false');
  } catch (error) {
    console.error('Error fixing user account:', error);
  } finally {
    // Close database connection
    DB.close();
  }
}

// Run the function
fixUserFirstLoginFlag();