import bcrypt from 'bcrypt';

async function generateHash() {
  const password = 'Qwerty#4321'; // Ganti dengan password yang diinginkan
  const saltRounds = 10;

  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Password:', password);
  console.log('Hash:', hash);
}

generateHash();