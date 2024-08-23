const express = require('express');
const path = require('node:path')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const expressSession = require('express-session');
const { PrismaClient } = require('@prisma/client');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');

const prisma = new PrismaClient();

// initialize express server and config views and public paths

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));

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
                return done(err);
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




// ----------Views Render--------------

app.get('/', async (req, res) => {
    console.log(req.user);
    const prova = await prisma.session.findMany();
    console.log(prova)
    res.render('index');
});





app.listen(3000, () => console.log('Server listening on port 3000'));