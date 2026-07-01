import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { storage } from "./storage";

export async function seedAdmin() {
  const count = await storage.countAdmins();
  if (count > 0) {
    return;
  }

  const username = "admin";
  const password = process.env.ADMIN_INITIAL_PASSWORD || nanoid(12);
  const passwordHash = await bcrypt.hash(password, 10);
  await storage.createAdmin(username, passwordHash);

  console.log("============================================");
  console.log(" Super Admin account created");
  console.log(` Username: ${username}`);
  console.log(` Password: ${password}`);
  console.log(" Login at: /admin/login");
  console.log(" Please save these credentials now.");
  console.log("============================================");

  const pagesCount = (await storage.getPages()).length;
  if (pagesCount === 0) {
    await storage.createPage({
      slug: "home",
      title: "Welcome",
      content: "This is the home page. Edit this content from the admin dashboard.",
      published: true,
    });
    await storage.createPage({
      slug: "about",
      title: "About Us",
      content: "Tell your visitors about your organization here.",
      published: true,
    });
  }
}
