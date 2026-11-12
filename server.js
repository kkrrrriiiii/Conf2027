import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from'./db.js'
import { User, Room, Requests } from "./db.js";
import session from 'express-session';
import bcrypt from "bcryptjs";


// const newRequest = Request.create({
//     userId: 1,
//     roomId: 2,
//     dateStart: "2027-10-04",
//     payment: "При очном посещении",
// });



const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// const users = db.prepare('SELECT * FROM users').all();
// const rooms = db.prepare('SELECT * FROM rooms').all();
// const requestsCount = db.prepare('SELECT * FROM requests').all();
// const reviewsCount = db.prepare('SELECT * FROM reviews').all();
// const allUsers = User.findAll();

// console.log("Созданная заявка:");
// console.log(newRequest)

// const newUser = User.create({
//     login: "test_user",
//     password: "test12345",
//     fio: "Тестов Тест",
//     phone: "8(999)111-22-33",
//     email: "test@example.com"
// });
// console.log(newUser)


app.set('view engine', 'ejs');
app.set('views', './views')

app.use(express.urlencoded({extended: true}));

app.use(express.static("public"))

app.use(session({
    secret: 'conf2027-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000*60*60*2,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

const INACTIVITY_LIMIT = 20*60*1000;
app.use((req, res, next) => {
    if(req.session && req.session.userId) {
        const now = Date.now();

        if (req.session.lastActivity && (now - req.session.lastActivity > INACTIVITY_LIMIT)){
            return req.session.destroy(() => {
                res.redirect('/login');
            })
        }
            req.session.lastActivity = now;
    }
        next();
});



const RULES = [
  { field: 'login',    test: v => /^[A-Za-z0-9]{6,}$/.test(v),             msg: 'Логин: латиница+цифры, минимум 6 символов' },
  { field: 'password', test: v => v && v.length >= 8,                      msg: 'Пароль: минимум 8 символов' },
  { field: 'fio',      test: v => /^[А-Яа-яЁё\s]+$/.test(v),               msg: 'ФИО: только кириллица и пробелы' },
  { field: 'phone',    test: v => /^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/.test(v), msg: 'Телефон: формат 8(ХХХ)ХХХ-ХХ-ХХ' },
  { field: 'email',    test: v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),    msg: 'Email: некорректный формат' }
];


const validate = data => RULES
  .filter(({ field, test }) => !test((data[field] || '').trim()))
  .map(r => r.msg);

const requireAuth = (req, res, next) =>
  req.session.userId ? next() : res.redirect('/login');

const requireAdmin = (req, res, next) =>
  req.session.login === 'Conf2027' ? next() : res.redirect('/login');
// app.get('/create', (req, res) => {
//     const rooms = Rooms.findAll()
//     res.render("create_request", {rooms, errors: []});
// });


app.get('/', (req, res) => {
    res.send(`<a href="/register">Регистрация</a> <a href="/login">Войти</a>`);
});

app.get('/create', (req, res) => {

    const rooms = Room.findAll()

    res.render('create',{
        rooms,
        errors: []
    });
    });


app.get('/register', (req, res) => {
    res.render('auth',{
        mode: 'register',
        form: {},
        errors: []
    });
 });

app.post("/register", (req, res) => {
        const errors = validate(req.body);

        if (User.exists(req.body.login)){
            errors.push("Логин уже занят")
        };
        if (errors.length) {
            return res.render("auth", {
                mode: "register",
                form: req.body,
                errors,
            });
        };

    User.create(req.body);

    req.session.flash = {
            type: 'success',
            text: 'Регестрация успешна. Войдите.'
        };
    res.redirect('/login')
});

    app.post('/login', (req, res) => {
        const user = User.findByLogin(req.body.login);

            if (user && bcrypt.compareSync(req.body.password, user.password)) {
                req.session.userId = user.id;
             req.session.fio = user.fio;
             req.session.login = user.login;
             req.session.lastActivity = Date.now();

        return res.redirect(user.login === 'Conf2027' ? '/admin' : '/dashboard');
    }

    res.render('auth', {
        mode: 'login',
        error: 'Неверный логин или пароль',
        flash: null
    });
});

app.get('/login', (req, res) => {
    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('auth', {
        mode: 'login',
        error: null,
        flash
    });
});


app.get("/admin", requireAdmin, (req, res) => {
  const requests = Requests.findAllDetailed();
  res.render("requests_list", { isAdmin: true, requests });
});

app.post("/admin", requireAdmin, (req, res) => {
  Requests.updateStatus(req.body.id, req.body.status);
  res.redirect("/admin");
});

app.all('/logout', (req, res) => {
    req.session.distroy(() => res.redirect('/login'));
});

app.get("/dashboard", requireAuth, (req, res) => {
  const requests = Requests.findByUser(req.session.userId);
  res.render("requests_list", { isAdmin: false, requests });
});



app.get("/", (req, res) => {
    res.render('rooms');
});

app.get("/rooms", (req, res) => {
    const rooms = Room.findAll()
    res.render('rooms', { rooms });
});

app.get("/rooms/type/:type", (req, res) => {
    const rooms = Room.findAll().filter(r => r.type === req.params.type)
    res.render('rooms', { rooms });
});




app.post('/create', requireAuth, (req, res) => {
  Requests.create({
    userId: req.session.userId,
    roomId: req.body.room_id,
    dateStart: req.body.date_start,
    payment: req.body.payment
  })
  res.redirect('/dashboard')
})

app.get("/request/:id", requireAuth, (req, res) => {
  const request = Requests.findDetailed(req.params.id);

  if (!request) {
    return res.status(404).send("Заявка не найдена");
  }

  const isOwner = request.user_id === req.session.userId;
  const isAdmin = req.session.login === "Conf2027";

  if (!isOwner && !isAdmin) {
    return res.status(403).send("Доступ запрещён");
  }

  res.render("request_detail", {
    request,
    isOwner,
    isAdmin,
  });
});

app.post("/review/:id", requireAuth, (req, res) => {
  const request = Requests.findDetailed(req.params.id);

  if (!request) {
    return res.status(404).send("Заявка не найдена");
  }

  if (request.user_id !== req.session.userId) {
    return res.status(403).send("Только владелец может оставить отзыв");
  }

  const review = (req.body.review || "").trim();

  Requests.addReview(request.id, req.session.userId, review);

  res.redirect(`/request/${request.id}`);
});


app.listen(PORT, () => {
    console.log(`Сервер: http://localhost:${PORT}`);
});