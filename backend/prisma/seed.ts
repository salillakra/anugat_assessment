import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  UserRole,
  RoomType,
  CourseType,
  DayOfWeek,
} from "./generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("🌱 Starting production-grade database seeding...");

  // 1. Clean data in reverse dependency order to clear constraints
  console.log("🧹 Flushing existing records cleanly...");
  await prisma.timetableSlot.deleteMany({});
  await prisma.timetable.deleteMany({});
  await prisma.courseFaculty.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});

  // Generate secure password hash for the demo accounts matching Bun environment
  const demoPasswordHash = await Bun.password.hash("demo123", "bcrypt");

  // 2. Seed Departments
  console.log("🏢 Seeding Departments...");
  const cseDept = await prisma.department.create({
    data: { name: "Computer Science & Engineering", code: "CSE" },
  });
  const mathDept = await prisma.department.create({
    data: { name: "Department of Mathematics", code: "MATH" },
  });
  const mgmtDept = await prisma.department.create({
    data: { name: "Department of Management Studies", code: "MGMT" },
  });
  const humDept = await prisma.department.create({
    data: { name: "Humanities and Social Sciences Department", code: "HUM" },
  });

  // 3. Seed Branches
  console.log("🌿 Seeding Academic Branches...");
  const csBranch = await prisma.branch.create({
    data: { name: "Computer Science", code: "CS", departmentId: cseDept.id },
  });
  const aimlBranch = await prisma.branch.create({
    data: {
      name: "Artificial Intelligence & Machine Learning",
      code: "AIML",
      departmentId: cseDept.id,
    },
  });
  const mcaBranch = await prisma.branch.create({
    data: {
      name: "Master of Computer Applications",
      code: "MCA",
      departmentId: cseDept.id,
    },
  });

  // 4. Seed Rooms (Classrooms and Labs)
  console.log("🏫 Seeding Infrastructure Rooms...");
  const roomsData = [
    { roomNumber: "219", type: RoomType.CLASSROOM },
    { roomNumber: "220", type: RoomType.CLASSROOM },
    { roomNumber: "213", type: RoomType.CLASSROOM },
    { roomNumber: "214", type: RoomType.CLASSROOM },
    { roomNumber: "216A", type: RoomType.CLASSROOM },
    { roomNumber: "Lab 1", type: RoomType.LAB },
    { roomNumber: "Lab 3", type: RoomType.LAB },
    { roomNumber: "Lab 4", type: RoomType.LAB },
    { roomNumber: "Lab 6", type: RoomType.LAB },
  ];

  const roomMap: Record<string, string> = {};
  for (const r of roomsData) {
    const createdRoom = await prisma.room.create({
      data: {
        roomNumber: r.roomNumber,
        capacity: r.type === RoomType.LAB ? 30 : 60,
        type: r.type,
        departmentId: cseDept.id,
      },
    });
    roomMap[r.roomNumber] = createdRoom.id;
  }

  // 5. Seed Users (Demo Accounts + Faculty Profiles)
  console.log("👥 Instantiating User Profiles and Core Demo Portals...");

  // Three mandatory demo accounts matching your explicit requirements
  await prisma.user.create({
    data: {
      name: "System Administrator",
      email: "admin@samayak.demo",
      passwordHash: demoPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      name: "Dr. Gautam Sarkhel",
      email: "dean@samayak.demo",
      passwordHash: demoPasswordHash,
      role: UserRole.DEAN,
    },
  });

  await prisma.user.create({
    data: {
      name: "Head of Department (CSE)",
      email: "hod.cs@samayak.demo",
      passwordHash: demoPasswordHash,
      role: UserRole.HOD,
      departmentId: cseDept.id,
    },
  });

  // Comprehensive Faculty Pool extracted across pages 1 to 13
  const facultyList = [
    {
      name: "Prof. Supratim Biswas",
      email: "s.biswas@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Sanchita Paul",
      email: "sanchitapaul@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Sumit Srivastava",
      email: "sumitsrivastava@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Amritanjali",
      email: "amritanjali@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Prashant Pranav",
      email: "ppranav@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Shruti Garg",
      email: "sgarg@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Subrajeet Mohapatra",
      email: "smohapatra@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Monu Bhagat",
      email: "monubhagat@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Debjani Mustafi",
      email: "dmustafi@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. N. K. Singh",
      email: "nksingh@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. K. Rajnish",
      email: "krajnish@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Supreeti Kamilya",
      email: "skamilya@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. K. S. Patnaik",
      email: "kspatnaik@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Akriti Nigam",
      email: "anigam@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Dr. Komal Naaz",
      email: "knaaz@bitmesra.ac.in",
      deptId: cseDept.id,
    },
    {
      name: "Jyoti Kumari",
      email: "jkumari@bitmesra.ac.in",
      deptId: humDept.id,
    },
    {
      name: "Department of Mathematics",
      email: "math.faculty@bitmesra.ac.in",
      deptId: mathDept.id,
    },
  ];

  const facultyMap: Record<string, string> = {};
  for (const f of facultyList) {
    const user = await prisma.user.create({
      data: {
        name: f.name,
        email: f.email,
        passwordHash: demoPasswordHash,
        role: UserRole.FACULTY,
        departmentId: f.deptId,
      },
    });
    facultyMap[f.name] = user.id;
  }

  // 6. Seed Courses (Mapping CourseType to match your explicit Schema enums)
  console.log("📚 Seeding Curricular Course Units...");
  const coursesData = [
    // B.Tech Sem 6
    {
      code: "CS333",
      name: "Compiler Design (CD)",
      credits: 4.0,
      type: CourseType.THEORY,
      semester: 6,
      branchId: csBranch.id,
    },
    {
      code: "CS335",
      name: "Artificial Intelligence and Machine Learning",
      credits: 4.0,
      type: CourseType.THEORY,
      semester: 6,
      branchId: csBranch.id,
    },
    {
      code: "CS334",
      name: "Compiler Design Lab (CD Lab)",
      credits: 1.5,
      type: CourseType.LAB,
      semester: 6,
      branchId: csBranch.id,
    },
    {
      code: "MT133",
      name: "Communications Skills II (CS-II)",
      credits: 1.5,
      type: CourseType.THEORY,
      semester: 6,
      branchId: csBranch.id,
    },
    // B.Tech AIML Sem 6
    {
      code: "A1305",
      name: "Deep Learning (DL)",
      credits: 3.0,
      type: CourseType.THEORY,
      semester: 6,
      branchId: aimlBranch.id,
    },
    {
      code: "A1303",
      name: "UnSupervised Learning (USL)",
      credits: 3.0,
      type: CourseType.THEORY,
      semester: 6,
      branchId: aimlBranch.id,
    },
    // B.Tech Sem 4
    {
      code: "CS24211",
      name: "Data Base Management System",
      credits: 3.0,
      type: CourseType.THEORY,
      semester: 4,
      branchId: csBranch.id,
    },
    {
      code: "MA24201",
      name: "Numerical Methods (NM)",
      credits: 2.0,
      type: CourseType.THEORY,
      semester: 4,
      branchId: csBranch.id,
    },
    // MCA Sem 2
    {
      code: "CA413",
      name: "Data Communication and Computer Networks",
      credits: 3.0,
      type: CourseType.THEORY,
      semester: 2,
      branchId: mcaBranch.id,
    },
    {
      code: "CA417",
      name: "Theory of Computation (TOC)",
      credits: 3.0,
      type: CourseType.THEORY,
      semester: 2,
      branchId: mcaBranch.id,
    },
  ];

  const courseMap: Record<string, string> = {};
  for (const c of coursesData) {
    const course = await prisma.course.create({
      data: {
        code: c.code,
        name: c.name,
        credits: c.credits,
        type: c.type,
        semester: c.semester,
        branchId: c.branchId,
      },
    });
    courseMap[c.code] = course.id;

    // Connect Primary Instructor to Course via CourseFaculty Join Table
    let primaryTeacher = "Prof. Supratim Biswas";
    if (c.code === "CS335") primaryTeacher = "Dr. Sanchita Paul";
    if (c.code === "A1305") primaryTeacher = "Dr. Monu Bhagat";
    if (c.code === "A1303") primaryTeacher = "Dr. Subrajeet Mohapatra";
    if (c.code === "CS24211") primaryTeacher = "Dr. Debjani Mustafi";
    if (c.code === "MA24201") primaryTeacher = "Department of Mathematics";
    if (c.code === "CA413") primaryTeacher = "Dr. Sumit Srivastava";
    if (c.code === "CA417") primaryTeacher = "Dr. Supreeti Kamilya";
    if (c.code === "MT133") primaryTeacher = "Jyoti Kumari";

    const facultyId = facultyMap[primaryTeacher];
    if (facultyId) {
      await prisma.courseFaculty.create({
        data: {
          courseId: course.id,
          facultyId: facultyId,
        },
      });
    }
  }

  // 7. Seed Timetables Framework
  console.log("📋 Instantiating Section Timetable Matrices...");
  const t1 = await prisma.timetable.create({
    data: {
      name: "B.Tech CS VIA Schedule",
      semester: 6,
      section: "A",
      branchId: csBranch.id,
    },
  });
  const t2 = await prisma.timetable.create({
    data: {
      name: "B.Tech AIML VI Schedule",
      semester: 6,
      section: "A",
      branchId: aimlBranch.id,
    },
  });
  const t3 = await prisma.timetable.create({
    data: {
      name: "B.Tech CS IVA Schedule",
      semester: 4,
      section: "A",
      branchId: csBranch.id,
    },
  });
  const t4 = await prisma.timetable.create({
    data: {
      name: "MCA II Schedule",
      semester: 2,
      section: "A",
      branchId: mcaBranch.id,
    },
  });

  // 8. Seed Timetable Slots mapping days, metrics, periods, and rooms precisely
  console.log("📆 Inserting Scheduled Allocation Slots...");
  const slotsData = [
    // Page 1: B.Tech VIA Slots
    {
      timetableId: t1.id,
      courseCode: "CS333",
      room: "219",
      day: DayOfWeek.MONDAY,
      period: 1,
      start: "08:00",
      end: "08:50",
      teacher: "Prof. Supratim Biswas",
    },
    {
      timetableId: t1.id,
      courseCode: "CS334",
      room: "Lab 6",
      day: DayOfWeek.TUESDAY,
      period: 6,
      start: "13:30",
      end: "16:20",
      teacher: "Prof. Supratim Biswas",
    },
    {
      timetableId: t1.id,
      courseCode: "MT133",
      room: "219",
      day: DayOfWeek.THURSDAY,
      period: 2,
      start: "09:00",
      end: "09:50",
      teacher: "Jyoti Kumari",
    },

    // Page 5: B.Tech AIML VI Slots
    {
      timetableId: t2.id,
      courseCode: "A1305",
      room: "216A",
      day: DayOfWeek.MONDAY,
      period: 2,
      start: "09:00",
      end: "09:50",
      teacher: "Dr. Monu Bhagat",
    },
    {
      timetableId: t2.id,
      courseCode: "A1303",
      room: "216A",
      day: DayOfWeek.WEDNESDAY,
      period: 6,
      start: "13:30",
      end: "14:20",
      teacher: "Dr. Subrajeet Mohapatra",
    },

    // Page 6: B.Tech CS IVA Slots
    {
      timetableId: t3.id,
      courseCode: "CS24211",
      room: "ILF",
      roomFallback: "Lab 1",
      day: DayOfWeek.MONDAY,
      period: 7,
      start: "14:30",
      end: "15:20",
      teacher: "Dr. Debjani Mustafi",
    },
    {
      timetableId: t3.id,
      courseCode: "MA24201",
      room: "214",
      day: DayOfWeek.TUESDAY,
      period: 2,
      start: "09:00",
      end: "09:50",
      teacher: "Department of Mathematics",
    },

    // Page 11: MCA II Slots
    {
      timetableId: t4.id,
      courseCode: "CA413",
      room: "214",
      day: DayOfWeek.MONDAY,
      period: 6,
      start: "13:30",
      end: "14:20",
      teacher: "Dr. Sumit Srivastava",
    },
    {
      timetableId: t4.id,
      courseCode: "CA417",
      room: "214",
      day: DayOfWeek.THURSDAY,
      period: 2,
      start: "09:00",
      end: "09:50",
      teacher: "Dr. Supreeti Kamilya",
    },
  ];

  for (const s of slotsData) {
    const cId = courseMap[s.courseCode];
    const rId = roomMap[s.room] || roomMap[s.roomFallback || ""];
    const fId = facultyMap[s.teacher];

    await prisma.timetableSlot.create({
      data: {
        timetableId: s.timetableId,
        courseId: cId || null,
        roomId: rId || null,
        facultyId: fId || null,
        dayOfWeek: s.day,
        period: s.period,
        startTime: s.start,
        endTime: s.end,
      },
    });
  }

  console.log(
    "🏁 Database seeding completed cleanly across all targeted models!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Seeding terminated via operational error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
