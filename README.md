# RunTrackerApp

แอปติดตามการวิ่งและปั่นจักรยานแบบ Android-first สร้างด้วย Expo/React Native รองรับการใช้งานแบบ guest, เก็บข้อมูลออฟไลน์, กู้คืนกิจกรรมที่กำลังติดตาม และซิงค์สองทางกับ Supabase

ฟีเจอร์หลักประกอบด้วยการวางแผนเส้นทางด้วยการแตะบนแผนที่, เลือกเส้นทางก่อนเริ่ม, แสดงจุดเริ่มและตำแหน่งปัจจุบันแบบเรียลไทม์, ตรวจจับการออกนอกเส้นทาง, Route Replay 15 วินาที และโปรไฟล์พร้อมรูป ชื่อ น้ำหนัก ส่วนสูง อายุ และเพศสำหรับการประเมินแคลอรี่

## เริ่มต้นใช้งาน

ต้องมี Node.js รุ่น LTS และ Android Studio หรืออุปกรณ์ Android ที่เปิด Developer options แล้ว

```bash
npm install
cp .env.example .env
```

ใส่ค่า Supabase และ Google Maps ใน `.env` ก่อนสร้าง development build:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-android-maps-key
```

นำไฟล์ `supabase/schema.sql` ไปรันใน SQL Editor ของโปรเจกต์ Supabase หนึ่งครั้งก่อนทดสอบการซิงค์

ถ้าเคยรัน schema รุ่นเก่าแล้ว ให้รัน `supabase/profile_upgrade.sql` เพิ่มอีกหนึ่งครั้ง ไฟล์นี้เพิ่มข้อมูลโปรไฟล์ใหม่และซ่อม RLS/API grants ที่ใช้ในการซิงค์ โดยไม่ลบกิจกรรมเดิม

เปิดผ่านเว็บเพื่อดู UI ได้ด้วย `npm run web` แต่การทดสอบแผนที่และ GPS บน Android ต้องใช้ development build ด้านล่าง

## ทดสอบบน Android

Background GPS ต้องใช้ development build; Expo Go ไม่ครอบคลุมพฤติกรรมนี้ทั้งหมด

```bash
npx expo run:android
```

ถ้าเห็นพื้นแผนที่สีครีมพร้อมโลโก้ Google แต่ไม่มีถนน แปลว่า native map เปิดได้แต่ Google ยังไม่อนุญาตให้โหลด tiles ให้ตรวจตามลำดับนี้:

1. Google Cloud Billing ต้อง Active (ไม่ใช่ Pending)
2. เปิด `Maps SDK for Android` ในโปรเจกต์เดียวกับ API key
3. จำกัด key แบบ Android apps ด้วย package `com.runtrackerapp` และ SHA-1 ของ debug/development keystore
4. โปรเจกต์ส่งคีย์ผ่าน `react-native-maps` config plugin; หลังแก้ `.env` หรือข้อจำกัด key ต้องสร้าง development build และติดตั้งใหม่ การสแกนด้วย Expo Go หรือ reload Metro จะไม่ฝังคีย์ของโปรเจกต์ลงแอป

Supabase โปรเจกต์นี้เปิด Confirm Email อยู่ หลังสมัครต้องกดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบ และบริการส่งอีเมลเริ่มต้นของ Supabase อาจส่งได้เฉพาะอีเมลสมาชิกในทีมโปรเจกต์จนกว่าจะตั้งค่า Custom SMTP

หลังติดตั้งแล้วให้ทดสอบ start, pause, resume, ล็อกหน้าจอ, สลับแอป, ปิดและเปิดแอปใหม่ แล้วจบกิจกรรม ตรวจว่าเส้นทางและระยะทางไม่ซ้ำ

## ตรวจคุณภาพ

```bash
npm run typecheck
npm test
npx expo export --platform web
```

สำหรับ Google Maps production ให้จำกัด API key ด้วย Android package name และ SHA-1 ของ signing certificate
