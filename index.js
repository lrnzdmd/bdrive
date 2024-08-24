const express = require('express');
const multer = require('multer');
const path = require('node:path')
const passport = require('passport');
const bcrypt = require('bcryptjs');
const LocalStrategy = require('passport-local').Strategy;
const expressSession = require('express-session');
const { PrismaClient } = require('@prisma/client');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const upload = multer({ dest: path.join(__dirname, '/uploads')});

const prisma = new PrismaClient();

// initialize express server and config views and public paths

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));

// middleware to only allow unauthenticated users to login and signup route

function checkAuthentication(req, res, next) {
    if (req.user) {
        return next();
    }
    res.redirect('/login');
}




// session store setup with prisma 

app.use(expressSession({
    cookie: {
        maxAge: 7 * 24 *60 * 60 * 1000 // 1000 (1sec) * 60(1min) * 60(1hou) * 24 (1day) * 7 (1wk)
    },
    secret: process.env.COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
    store: new PrismaSessionStore(
        new PrismaClient(),
        {
            checkPeriod: 2 * 60 * 1000, // 2 min
            dbRecordIdIsSessionId: true,
            dbRecordIdFunction: undefined,
        }
    )
}));

app.use(passport.session());

passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const user = await prisma.user.findUnique({where: { username: username }});
               
                if (!user) {
                    return done(null, false, { message: 'incorrect username'});
                }

                const match = await bcrypt.compare(password, user.password);

                if (!match) {
                    return done(null,false, {message: 'incorrect password'});
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

passport.deserializeUser(async (id,done) => {
    try {
        const user = await prisma.user.findUnique({ where: {id: id}});

        done(null, user);

    } catch (error) {
        done(error);
    }
});

app.use((req,res,next) => {
    res.locals.currentUser = req.user;
    next();
})




// ----------Views Render--------------

app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/signup') {
        return next();
    }
    checkAuthentication(req, res, next);
});

app.get('/', async (req, res) => {

    res.redirect(`/drive/${req.user.id}/${req.user.fullName}/${req.user.homeFolderId}/1`);
});

app.get('/drive/:userid/:username/:folderid/:pagenumber', async (req, res) => {
    const userid = parseInt(req.params.userid, 10);
    const folderid = parseInt(req.params.folderid, 10);

    if (req.user.id !== userid) {
        return res.status(403)._construct(`Access denied, you don't have the permissions to view this page.`)
    } else {
        try {
        const folder = await prisma.folder.findUnique({
            where: { id: folderid },
            include: {
                files: true,
                subfolders: {
                    include: {
                        subfolders: true,
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
       

        // create an array of parents of the folder to get a path for the breadcrumbs

        let parentf = folder;
        const path = [];
        path.push(folder.name);
        while (parentf.parentId !== null) {
        path.push(parentf.parent.name);
        parentf = parentf.parent;
        }
        path.reverse();
       



       res.render('home', { folder, path });  
        }
        catch (error) {
            console.error(error);
            res.status(500).send("Internal server error.");
        }
    }
})

app.get('/download/:userid/:fileid', async (req,res) => {
    const currid = parseInt(req.user.id);
    const userid = parseInt(req.params.userid);
    const fileid = parseInt(req.params.fileid);

    if (currid !== userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to download this file.`)
    } else { 
        try {
            const path = await prisma.file.findUnique({
                where:{
                    id: fileid,
                },
            });
            res.download(path.url,path.name, (error) => {
                if (error) {
                console.error('Error downloading file: ',error);
                res.status(500).send('Error downloading file.');
                }
            });

        } catch (error) {
            res.status(500).send('Error fetching file: ',error);
        }

    }
})

app.post('/upload/:userid/:folderid', upload.single('newFile') ,async function (req,res,next) {
    const currid = parseInt(req.user.id);
    const userid = parseInt(req.params.userid);
    const parentid = parseInt(req.params.folderid);
    if (currid !== userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to view this page.`)
    } else { 
        await prisma.file.create({
            data: {
                name: req.file.originalname,
                size: req.file.size,
                url: req.file.path,
                ownerId: userid,
                parentId: parentid,
            },
        });
        res.redirect(req.get('Referer'));
    }
})

app.get('/new/:userid/folder/:folderid', async (req,res) => {
    const currid = parseInt(req.user.id);
    const userid = parseInt(req.params.userid)
    const parentid = parseInt(req.params.folderid)
    if (currid != userid) {
        return res.status(403).send(`Access denied, you don't have the permissions to view this page.`)
    } else { 
        try {
            await prisma.folder.create({
            data:{
                name: 'New folder',
                ownerId: userid,
                parentId: parentid,
            }
            });
            res.redirect(req.get('Referer'));
        } catch (error) {
            res.status(500).send('Internal server error');
        }
        
    }
})

app.get('/login', (req, res) => res.render('login'));

app.post('/login',
        passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login'
    })
);

app.get('/logout', (req,res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        } 
        res.redirect('/');
    });
});

app.get('/signup', (req,res) => {
    res.render('signup');
})

app.post('/signup', async (req, res, next) => {
    try {
        bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
            if (err) {
                return next(err);
            }
            try {
                const user = await prisma.user.create({
                    data: {
                        username: req.body.username,
                        fullName: req.body.fullname,
                        password: hashedPassword,
                    },
                });

                const homeFolder = await prisma.folder.create({
                    data: {
                        name:'Home',
                        ownerId:user.id,
                    },
                });

                await prisma.user.update({
                    where: {id: user.id },
                    data: {
                        homeFolderId: homeFolder.id,
                    },
                });

            res.redirect('/');
            } catch (error) {
                return next(error);
            }

            
        })
    } catch (error) {
        return next(error);
    }

})




app.listen(3000, () => console.log('Server listening on port 3000'));