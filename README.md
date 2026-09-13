# RunTrackerApp

แอปติดตามการวิ่งและปั่นจักรยานแบบ Android-first สร้างด้วย Expo/React Native รองรับการใช้งานแบบ guest, เก็บข้อมูลออฟไลน์, กู้คืนกิจกรรมที่กำลังติดตาม และซิงค์สองทางกับ Supabase

## เริ่มต้นใช้งาน

ต้องมี Node.js รุ่น LTS และ Android Studio หรืออุปกรณ์ Android ที่เปิด Developer options แล้ว

```bash
npm install
cp .env.example .env
npm run android
```

ใส่ค่า Supabase และ Google Maps ใน `.env` ก่อนสร้าง development build:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-android-maps-key
```

นำไฟล์ `supabase/schema.sql` ไปรันใน SQL Editor ของโปรเจกต์ Supabase หนึ่งครั้งก่อนทดสอบการซิงค์

## ทดสอบบน Android

Background GPS ต้องใช้ development build; Expo Go ไม่ครอบคลุมพฤติกรรมนี้ทั้งหมด

```bash
npx expo run:android
```

หลังติดตั้งแล้วให้ทดสอบ start, pause, resume, ล็อกหน้าจอ, สลับแอป, ปิดและเปิดแอปใหม่ แล้วจบกิจกรรม ตรวจว่าเส้นทางและระยะทางไม่ซ้ำ

## ตรวจคุณภาพ

```bash
npm run typecheck
npm test
npx expo export --platform web
```

สำหรับ Google Maps production ให้จำกัด API key ด้วย Android package name และ SHA-1 ของ signing certificate
