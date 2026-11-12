import Database from "better-sqlite3";
import {fileURLToPath} from 'url';
import { dirname, join } from "path";
import bcrypt from "bcryptjs";


const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'conf.db'));
db.pragma("foreign_keys = ON");
db.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fio TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
    `)

    const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const hash = (pwd) => bcrypt.hashSync(pwd, 10);

    if (count ===0){
        const stmt = db.prepare(`
            INSERT INTO users(login, password, fio, phone, email)
            VALUES(?, ?, ?, ?, ?)
            `)
            stmt.run('ivan', hash ('demo'), 'Иванов Иван', '89999999999', 'ivan@exsample.com')
            stmt.run('petr', hash ('demo'), 'Петров Петр', '89888888888', 'petr@exsample.com')
            stmt.run('anna', hash ('demo'), 'Сидорова Анна', '89777777777', 'anna@exsample.com')
            stmt.run('Conf2027', hash ('Demo77'), 'Администратор', '8(999)000-00-00', 'admin@conf.ru');
            console.log('Тестовые пользоваители добавлены')
    }




db.exec(`
    CREATE TABLE IF NOT EXISTS rooms(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      capacity INTEGER NOT NULL
    )
    `)

    const countRoom = db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c;

    if (count === 0){
        const stmtRoom = db.prepare(`
            INSERT INTO rooms(name, type, capacity)
            VALUES(?, ?, ?)
            `)
            stmtRoom.run('A', 'зал', '1')
            stmtRoom.run('B', 'зал', '2')
            stmtRoom.run('C', 'зал', '3')
            console.log('Тестовые комнаты добавлены')
    }

db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    date_start TEXT NOT NULL,
    payment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Новая',
    review TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
    )
    `)

    const requestsCount = db.prepare("SELECT COUNT(*) AS c FROM requests").get().c;

    if(requestsCount === 0){
        const stmtRequests = db.prepare(`
            INSERT INTO requests(user_id, room_id, date_start, payment)
            VALUES(?, ?, ?, ?)
            `)
            stmtRequests.run(1, 1, '2027-03-15', 'При очном посещении')
            stmtRequests.run(1, 3, '2027-03-20', 'Перевод по СБП')
            stmtRequests.run(2, 3, '2027-04-01', 'При очном посещении')
            console.log('Тестовые заявки добавлены')

    }
    db.exec(`
        CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requests_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (requests_id) REFERENCES requests(id) ON DELETE CASCADE
        );
        `)


        const reviewsCount = db.prepare("SELECT COUNT(*) AS c FROM reviews").get().c;

        if(reviewsCount === 0){
             const stmtReviews = db.prepare(`
            INSERT INTO reviews(requests_id, rating, comment)
            VALUES(?, ?, ?)
            `)
            stmtReviews.run(1, 5, 'Отлично')
            stmtReviews.run(2, 2, 'Ужасно')
            stmtReviews.run(3, 1, 'Очень плохо')
        }
        const result = db.prepare(`
            SELECT
            reviews.id  AS review_id,
            reviews.rating,
            reviews.comment,
            requests.date_start,
            requests.payment,
            requests.status,
            users.fio AS user_name,
            rooms.name AS room_name,
            rooms.type AS room_type
            FROM reviews
            JOIN requests ON reviews.requests_id =  requests.id
            JOIN users ON  requests.user_id = users.id
            JOIN rooms ON  requests.room_id = rooms.id
            `)
            .all()



        class UserModel {
            constructor(){
                this.table = "users";
            }
                findById(id){
                    return db.prepare(`SELECT * FROM ${this.table} WHERE id =?`).get(id);
                }
                findByLogin(login){
                    return db.prepare(`SELECT * FROM ${this.table} WHERE login =?`).get(login);
                }
                findAll() { 
                    return db.prepare(`SELECT * FROM ${this.table}`).all(); 
                }
                count() {
                    const result = db.prepare(`SELECT COUNT(*) AS total FROM ${this.table}`).get();
                    return result.total;
                }
                exists(login) { 
                    const stmt = db.prepare(`SELECT EXISTS(SELECT 1 FROM ${this.table} WHERE login = ?)`).get(login); 
                    return Boolean(stmt['EXISTS']);
             }
             create({ login, password, fio, phone, email}) {
              const hash = bcrypt.hashSync(password, 10);
              const r = db.prepare(`
                INSERT INTO ${this.table} (login, password, fio, phone, email)
                 VALUES(?, ?, ?, ?, ?)
              `).run(login, hash, fio, phone, email);
               return this.findById(r.lastInsertRowid);
                  }
                
            }
            export const User = new UserModel();

    class RoomModel {
         constructor() {
        this.table = 'rooms';
            }

        findAll() { 
        return db.prepare(`SELECT * FROM ${this.table}`).all(); 
        }

        findById(id) { 
        return db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id); 
        }
        findByType(type) { 
        return db.prepare(`SELECT * FROM ${this.table} WHERE type = ?`).all(type);
        }

        count() { 
        const result = db.prepare(`SELECT COUNT(*) AS total FROM ${this.table}`).get();
        return result.total; 
        }
    }
        export const Room = new RoomModel();

    class RequestModel {
  constructor() {
    this.table = 'requests';
  }

  findById(id) { 
    return db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id); 
  }


  findByUser(userId) { 
    return db.prepare(`
      SELECT requests.*, rooms.name AS room_name, rooms.type AS room_type
      FROM ${this.table}
      LEFT JOIN rooms ON requests.room_id = rooms.id
      WHERE user_id = ?
    `).all(userId);
  }

  findAllDetailed() { 
    return db.prepare(`
      SELECT requests.*,
        users.fio AS user_fio,
        rooms.name AS room_name,
        rooms.type AS room_type
      FROM ${this.table}
      LEFT JOIN users ON requests.user_id = users.id
      LEFT JOIN rooms ON requests.room_id = rooms.id
    `).all();
  }

  count() { 
    const result = db.prepare(`SELECT COUNT(*) AS total FROM ${this.table}`).get(); 
    return result.total; 
  }

  updateStatus(id, status) { 
    const stmt = db.prepare(`UPDATE ${this.table} SET status = ? WHERE id = ?`);
    stmt.run(status, id);
  }
  create({ userId, roomId, dateStart, payment }) {
  const r = db.prepare(`
    INSERT INTO ${this.table} (user_id, room_id, date_start, payment)
    VALUES(?, ?, ?, ?)
    `).run(userId, roomId, dateStart, payment);
    return this.findById(r.lastInsertRowid);
}

findDetailed(id) {
  return db.prepare(`
    SELECT r.*,
           u.fio AS fio,
           u.login AS user_login,
           u.email AS user_email,
           u.phone AS user_phone,
           rm.name AS room_name,
           rm.type AS room_type,
           rm.capacity AS room_capacity
    FROM ${this.table} r
    JOIN users u ON u.id = r.user_id
    JOIN rooms rm ON rm.id = r.room_id
    WHERE r.id = ?
  `).get(id);
}

addReview(id, userId, review) {
  if (!review || !review.trim()) return false;
  const r = db.prepare(`
    UPDATE ${this.table}
    SET review = ?
    WHERE id = ? AND user_id = ? AND status = 'Завершено'
  `).run(review.trim(), id, userId);
  return r.changes > 0;
}
}

export const Requests = new RequestModel();

export default db;