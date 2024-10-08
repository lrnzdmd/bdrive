const express = require("express");
const multer = require("multer");
const path = require("node:path");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const LocalStrategy = require("passport-local").Strategy;
const expressSession = require("express-session");
const { PrismaClient } = require("@prisma/client");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const fileRouter = require("./routes/fileRouter");
const folderRouter = require("./routes/folderRouter");
const { createClient } = require("@supabase/supabase-js");

const prisma = new PrismaClient();

// Supabase client setup for file storage or other services.
// Memory storage for Multer to handle file uploads in memory before processing.
// (This is not a scalable solution, will most certainly have to change it later)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_APIKEY
);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// initialize express server and config views and public paths

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

// Utility function to format file sizes for displaying in the UI (e.g., when listing files).

function formatFileSize(bytes) {
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }

  return `${size.toFixed(2)} ${units[index]}`;
}

// Generates breadcrumb navigation by iterating through folder parents.
// It fetches each folder's parent recursively to build the full path.

async function generateBreadcrumbs(folder) {
  let currid = folder.id;
  const path = [];
  while (currid) {
    const foldr = await prisma.folder.findUnique({ where: { id: currid } });
    if (!foldr) {
      return res.status(500).send("error fetching folders parents");
    }
    path.push(foldr.name);
    currid = foldr.parentId;
  }
  path.reverse();
  return path;
}

// Splits the folder's contents (subfolders and files) into pages for pagination.
// `amountforpage` defines how many items are displayed per page.

async function splitIntoPages(folder, pageindex, amountforpage = 10) {
  const completeList = [...folder.subfolders, ...folder.files];

  if (completeList.length > amountforpage) {
    const pages = [];
    for (let i = 0; i < completeList.length; i += amountforpage) {
      pages.push(completeList.slice(i, i + amountforpage));
    }
    folder.completeList = pages;
  } else {
    folder.completeList = [completeList];
  }
  folder.currentPageIndex = pageindex - 1;
}

// middleware to only allow unauthenticated users to login and signup route

function checkAuthentication(req, res, next) {
  if (req.user) {
    return next();
  }
  res.redirect("/login");
}

// session store setup with prisma

app.use(
  expressSession({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1000 (1sec) * 60(1min) * 60(1hou) * 24 (1day) * 7 (1wk)
    },
    secret: process.env.COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
    store: new PrismaSessionStore(new PrismaClient(), {
      checkPeriod: 2 * 60 * 1000, // 2 min
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(passport.session());

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { username: username },
      });

      if (!user) {
        return done(null, false, { message: "incorrect username" });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return done(null, false, { message: "incorrect password" });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: id } });

    done(null, user);
  } catch (error) {
    done(error);
  }
});

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// ----------Views Render--------------

app.use((req, res, next) => {
  if (req.path === "/login" || req.path === "/signup") {
    return next();
  }
  checkAuthentication(req, res, next);
});

app.use("/file", fileRouter);
app.use("/folder", folderRouter);

app.get("/", async (req, res) => {
  res.redirect(
    `/drive/${req.user.id}/${req.user.fullName}/${req.user.homeFolderId}/1`
  );
});

app.get("/drive/:userid/:username/:folderid/:pagenumber", async (req, res) => {
  const userid = parseInt(req.params.userid, 10);
  const folderid = parseInt(req.params.folderid, 10);
  const pageindex = parseInt(req.params.pagenumber, 10);

  if (req.user.id !== userid) {
    return res
      .status(403)
      .send(
        `Access denied, you don't have the permissions to view this page.`
      );
  }
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderid },
      include: {
        files: {
          orderBy: {
            updatedAt: "desc",
          },
        },
        subfolders: {
          orderBy: {
            updatedAt: "desc",
          },
          include: {
            subfolders: {
              orderBy: {
                updatedAt: "desc",
              },
              include: {
                subfolders: true,
                parent: true,
              },
            },
            parent: true,
          },
        },
        parent: {
          include: {
            subfolders: true,
            parent: true,
          },
        },
      },
    });

    if (!folder) {
      return res.status(404).send("Not Found");
    }

    folder.breadcrumbs = await generateBreadcrumbs(folder);

    splitIntoPages(folder, pageindex);

    res.render("home", { folder });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.all("/search/:searchvalue/:pagenumber", async (req, res) => {
  const pageindex = parseInt(req.params.pagenumber, 10);
  const folder = { subfolders: [], files: [] };
  try {
    folder.breadcrumbs = ["Search", req.params.searchvalue];
    folder.files = await prisma.file.findMany({
      where: {
        name: {
          contains: req.body.search,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    splitIntoPages(folder, pageindex);

    res.render("home", { folder });
  } catch (error) {
    console.error(error);
    res.status(500).send("error");
  }
});

app.post(
  "/upload/:userid/:folderid",
  upload.single("newFile"),
  async function (req, res, next) {
    const currid = parseInt(req.user.id);
    const userid = parseInt(req.params.userid);
    const parentid = parseInt(req.params.folderid);
    if (currid !== userid) {
      return res
        .status(403)
        .send(
          `Access denied, you don't have the permissions to view this page.`
        );
    }
    if (!req.file) {
      return res.status(400).send("No file sent for upload");
    }
    try {
      const filePath = `${parentid}/${req.file.originalname}`;

      const { data, error } = await supabase.storage
        .from("bdrive")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) {
        console.error(error);
        return res
          .status(parseInt(error.statusCode))
          .send(error.error + " " + error.message);
      }

      await prisma.file.create({
        data: {
          name: req.file.originalname,
          size: req.file.size,
          sizeShort: formatFileSize(req.file.size),
          cloudId: data.id,
          url: data.path,
          ownerId: currid,
          parentId: parentid,
        },
      });

      res.redirect("/");
    } catch (error) {
      console.error("Error processing the upload:", error);
      res.status(500).send("Internal server error");
    }
  }
);

app.get("/new/:userid/folder/:folderid", async (req, res) => {
  const currid = parseInt(req.user.id);
  const userid = parseInt(req.params.userid);
  const parentid = parseInt(req.params.folderid);
  if (currid != userid) {
    return res
      .status(403)
      .send(`Access denied, you don't have the permissions to view this page.`);
  }
  try {
    await prisma.folder.create({
      data: {
        name: "New folder",
        ownerId: userid,
        parentId: parentid,
      },
    });
    res.redirect("/");
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

app.get("/login", (req, res) => res.render("login"));

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res, next) => {
  try {
    bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
      if (err) {
        return next(err);
      }

      const user = await prisma.user.create({
        data: {
          username: req.body.username,
          fullName: req.body.fullname,
          password: hashedPassword,
        },
      });

      const homeFolder = await prisma.folder.create({
        data: {
          name: "Home",
          ownerId: user.id,
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          homeFolderId: homeFolder.id,
        },
      });

      res.redirect("/");
    });
  } catch (error) {
    return next(error);
  }
});

app.listen(3000, () => console.log("Server listening on port 3000"));
