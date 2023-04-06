import express from 'express';
import session from 'express-session';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import axios from 'axios';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';

const saltRounds = 10;

const app = express();

const cache = new NodeCache({ stdTTL: 86400 });

app.get('/movie-of-the-day', async (req, res) => {
  try {
    // Check if the movie is already cached
    const cachedMovie = cache.get('movie-of-the-day');
    if (cachedMovie) {
      // Display the cached movie to the user
      res.render('movie-of-the-day', { movie: cachedMovie });
      return;
    }

    // Fetch a random movie from TMDB API
    const response = await fetch('https://api.themoviedb.org/3/discover/movie?api_key=f7b138552a3ba34c25115cff576920df&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=1');
    const data = await response.json();

    // Get a random movie from the response
    const randomMovieIndex = Math.floor(Math.random() * data.results.length);
    const randomMovie = data.results[randomMovieIndex];

    // Store the random movie on the server side for one day
    cache.set('movie-of-the-day', randomMovie);

    // Display the movie to the user
    res.render('movie-of-the-day', { movie: randomMovie });
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while fetching the movie.');
  }
});

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static('public'));


app.get('/search', (req, res) => {
  if (req.session.loggedin) {
  res.render('search');}
  else{
    return res.send('Please login to view this page! <a href="/">Login here</a>');
  }
});


app.get('/tv_search', (req, res) => {
  if (req.session.loggedin) {
  res.render('tv_search');}
  else{
    return res.send('Please login to view this page! <a href="/">Login here</a>');
  }
});


const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '7895123',
    database: 'test_database3'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to database!');
});

app.get('/', (req, res) => {
    res.render('login');
});

app.get('/mov', (req, res) => {
  if (req.session.loggedin) {
    res.render('movie-details', { username: req.session.username , movieId : req.body.movieId });}
    else{
      return res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/auth', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    if (username && password) {
      connection.query('SELECT * FROM user_data WHERE username = ?', [username], (err, results, fields) => {
        if (results.length > 0) {
          const hashedPassword = results[0].password;
          bcrypt.compare(password, hashedPassword, (err, result) => {
            if (result === true) {
              req.session.loggedin = true;
              req.session.username = username;
              //console.log(req.session.user);
              res.redirect('/dashboard');
            } else {
              res.render('login', { error: 'Incorrect username and/or password!' });
            }
          });
        } else {
          res.render('login', { error: 'Incorrect username and/or password!' });
        }
      });
    } else {
      res.render('login', { error: 'Please enter username and password!' });
    }
  });

  app.post('/register', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const name = req.body.name;
    const age = req.body.age;
    const email = req.body.email;
    const fgenre = req.body.genre;
    const country = req.body.country;
    const cpass = req.body.cpass;

    if (username && password && name && age && email && fgenre && country && cpass) {
      try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        connection.query('INSERT INTO user_data (username, name, age, email, fgenre, country, password) VALUES (?, ?, ?, ?, ?, ?, ?)', [username, name, age, email, fgenre, country, hashedPassword], (err, results) => {
          if (err) throw err;
          res.redirect('/');
        });
      } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
      }
    } else {
      res.send('Please fill all fields!');
    }
  });

app.get('/dashboard', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const movieDetails = req.query.movieName ? await getMovieDetails(req.query.movieName) : null;
            res.render('dashboard', { username: req.session.username, movieDetails });
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    } else {
        return res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  });

app.post('/movie-details', async (req, res) => {
    if (!req.session.loggedin) {
      return res.redirect('/');
    }
  
    const API_KEY = 'cb271ca40b23866a540695b98e939277';
    const BASE_URL = 'https://api.themoviedb.org/3';
  
    const { movieName } = req.body;
  
    try {
      const response = await axios.get(`${BASE_URL}/search/movie`, {
        params: {
          api_key: API_KEY,
          query: movieName
        }
      });
      const movieId = response.data.results[0].id;
      const movieDetailsResponse = await axios.get(`${BASE_URL}/movie/${movieId}`, {
        params: {
          api_key: API_KEY
        }
      });
      const movieDetails = movieDetailsResponse.data;
      res.render('dashboard', { username: req.session.username, movieDetails });
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  });
 
  app.get('/movie-details', async (req, res) => {
    if (!req.session.loggedin) {
      return res.redirect('/');
    }
  
    const API_KEY = 'cb271ca40b23866a540695b98e939277';
    const BASE_URL = 'https://api.themoviedb.org/3';
  
    const { movieId } = req.query;
  
    try {
      const response = await axios.get(`${BASE_URL}/movie/${movieId}`, {
        params: {
          api_key: API_KEY
        }
      });
      const movieDetails = response.data;
      res.render('movie-details', { movieDetails, movieId });
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  });
  
  app.get('/library', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      const selectSql = 'SELECT movie_id FROM user_movie_data WHERE username = ?';
      const selectValues = [username];
  
      connection.query(selectSql, selectValues, (err, results) => {
        if (err) {
          res.render('library', { message: 'An error occurred while retrieving your library.' });
        } else {
          const movieIds = results.map(result => result.movie_id);
          const error = req.query.error;
  
          // Fetch movie details from TMDB API
          const fetchPromises = movieIds.map(movieId => {
            const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
            return fetch(tmdbUrl).then(response => response.json());
          });
  
          Promise.all(fetchPromises)
            .then(movies => {
              res.render('library', { movies , message: req.query.message });
            })
            .catch(err => {
              console.error(err);
              res.render('library', { message: 'An error occurred while retrieving movie details.' });
            });
        }
      });
    } else {
      res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });

    
  app.get('/watchlist', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      const selectSql = 'SELECT movie_id FROM user_watchlist WHERE username = ?';
      const selectValues = [username];
  
      connection.query(selectSql, selectValues, (err, results) => {
        if (err) {
          res.render('watchlist', { message: 'An error occurred while retrieving your library.' });
        } else {
          const movieIds = results.map(result => result.movie_id);
          const error = req.query.error;
  
          // Fetch movie details from TMDB API
          const fetchPromises = movieIds.map(movieId => {
            const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
            return fetch(tmdbUrl).then(response => response.json());
          });
  
          Promise.all(fetchPromises)
            .then(movies => {
              res.render('watchlist', { movies , message: req.query.message });
            })
            .catch(err => {
              console.error(err);
              res.render('watchlist', { message: 'An error occurred while retrieving movie details.' });
            });
        }
      });
    } else {
      res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });
  
  app.get('/user', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      console.log(username);
      connection.query('SELECT username,name,age,email,fgenre,country  FROM user_data WHERE username = ?', [username], (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while fetching user data.');
        } else {
          
          console.log(results)
          res.render('user_profile', { userData : results[0] });
        }
      });
    } else {
      res.redirect('/');
    }
  });
  
  // Update user profile route
app.post('/user/update', (req, res) => {
  const { name, age, email, fgenre, country } = req.body;
  const username = req.session.username;
  
  connection.query('UPDATE user_data SET name=?, age=?, email=?, fgenre=?, country=? WHERE username=?', [name, age, email, fgenre, country, username], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('An error occurred while updating user data.');
    } else {
      res.redirect('/user');
    }
  });
});


  app.post('/add-movie', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      console.log(username);
      const movieId = req.body.movieId;
  
      if (!movieId) {
        return res.status(400).send('Movie ID cannot be empty');
      }
  
      const checkSql = 'SELECT movie_id FROM user_movie_data WHERE username = ? AND movie_id = ?';
      const checkValues = [username, movieId];
  
      connection.query(checkSql, checkValues, (err, results) => {
        if (err) {
          res.render('library', { message: 'An error occurred while checking for the movie.', movies: [] });
        } else if (results.length > 0) {
          const selectSql = 'SELECT movie_id FROM user_movie_data WHERE username = ?';
          const selectValues = [username];
  
          connection.query(selectSql, selectValues, (err, results) => {
            if (err) {
              res.render('library', { message: 'An error occurred while retrieving your library.', movies: [] });
            } else {
              const movieIds = results.map(result => result.movie_id);
              const fetchPromises = movieIds.map(movieId => {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
                return fetch(tmdbUrl).then(response => response.json());
              });
  
              Promise.all(fetchPromises)
                .then(movies => {
                  res.render('library', { movies, message: `Movie already exists in your library. Here's your library.`, error: true });
                })
                .catch(err => {
                  console.error(err);
                  res.render('library', { message: 'An error occurred while retrieving movie details.', movies: [] });
                });
            }
          });
        } else {
          const insertSql = 'INSERT INTO user_movie_data (username, movie_id) VALUES (?, ?)';
          const insertValues = [username, movieId];
  
          connection.query(insertSql, insertValues, (err, result) => {
            if (err) {
              res.render('library', { message: 'An error occurred while adding the movie to the library.', movies: [] });
            } else {
              const selectSql = 'SELECT movie_id FROM user_movie_data WHERE username = ?';
              const selectValues = [username];
  
              connection.query(selectSql, selectValues, (err, results) => {
                if (err) {
                  res.render('library', { message: 'An error occurred while retrieving your library.', movies: [] });
                } else {
                  const movieIds = results.map(result => result.movie_id);
                  const fetchPromises = movieIds.map(movieId => {
                    const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
                    return fetch(tmdbUrl).then(response => response.json());
                  });
  
                  Promise.all(fetchPromises)
                    .then(movies => {
                      res.render('library', { movies, message: 'Movie added to your library.' });
                    })
                    .catch(err => {
                      console.error(err);
                      res.render('library', { message: 'An error occurred while retrieving movie details.', movies: [] });
                    });
                }
              });
            }
          });
        }
      });
    } else {
      return res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });

  app.post('/remove-movie', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      console.log(username);
      const movieId = req.body.movieId;
  
      if (!movieId) {
        return res.status(400).send('Movie ID cannot be empty');
      }
  
      const deleteSql = 'DELETE FROM user_movie_data WHERE username = ? AND movie_id = ?';
      const deleteValues = [username, movieId];
  
      connection.query(deleteSql, deleteValues, (err, result) => {
        if (err) {
          res.render('library', { message: 'An error occurred while removing the movie from the library.', movies: [] });
        } else {
          const selectSql = 'SELECT movie_id FROM user_movie_data WHERE username = ?';
          const selectValues = [username];
  
          connection.query(selectSql, selectValues, (err, results) => {
            if (err) {
              res.render('library', { message: 'An error occurred while retrieving your library.', movies: [] });
            } else {
              const movieIds = results.map(result => result.movie_id);
              const fetchPromises = movieIds.map(movieId => {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
                return fetch(tmdbUrl).then(response => response.json());
              });
  
              Promise.all(fetchPromises)
                .then(movies => {
                  res.render('library', { movies, message: 'Movie removed from your library.' });
                })
                .catch(err => {
                  console.error(err);
                  res.render('library', { message: 'An error occurred while retrieving movie details.', movies: [] });
                });
            }
          });
        }
      });
    } else {
      return res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });
  

  app.post('/add-watchlist', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      console.log(username);
      const movieId = req.body.movieId;
  
      if (!movieId) {
        return res.status(400).send('Movie ID cannot be empty');
      }
  
      const checkSql = 'SELECT movie_id FROM user_watchlist WHERE username = ? AND movie_id = ?';
      const checkValues = [username, movieId];
  
      connection.query(checkSql, checkValues, (err, results) => {
        if (err) {
          res.render('watchlist', { message: 'An error occurred while checking for the movie.', movies: [] });
        } else if (results.length > 0) {
          const selectSql = 'SELECT movie_id FROM user_watchlist WHERE username = ?';
          const selectValues = [username];
  
          connection.query(selectSql, selectValues, (err, results) => {
            if (err) {
              res.render('watchlist', { message: 'An error occurred while retrieving your watchlist.', movies: [] });
            } else {
              const movieIds = results.map(result => result.movie_id);
              const fetchPromises = movieIds.map(movieId => {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
                return fetch(tmdbUrl).then(response => response.json());
              });
  
              Promise.all(fetchPromises)
                .then(movies => {
                  res.render('watchlist', { movies, message: `Movie already exists in your watchlist. Here's your Watchlist.`, error: true });
                })
                .catch(err => {
                  console.error(err);
                  res.render('watchlist', { message: 'An error occurred while retrieving movie details.', movies: [] });
                });
            }
          });
        } else {
          const insertSql = 'INSERT INTO user_watchlist (username, movie_id) VALUES (?, ?)';
          const insertValues = [username, movieId];
  
          connection.query(insertSql, insertValues, (err, result) => {
            if (err) {
              res.render('watchlist', { message: 'An error occurred while adding the movie to the watchlist.', movies: [] });
            } else {
              const selectSql = 'SELECT movie_id FROM user_watchlist WHERE username = ?';
              const selectValues = [username];
  
              connection.query(selectSql, selectValues, (err, results) => {
                if (err) {
                  res.render('watchlist', { message: 'An error occurred while retrieving your watchlist.', movies: [] });
                } else {
                  const movieIds = results.map(result => result.movie_id);
                  const fetchPromises = movieIds.map(movieId => {
                    const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
                    return fetch(tmdbUrl).then(response => response.json());
                  });
  
                  Promise.all(fetchPromises)
                    .then(movies => {
                      res.render('watchlist', { movies, message: 'Movie added to your watchlist.' });
                    })
                    .catch(err => {
                      console.error(err);
                      res.render('watchlist', { message: 'An error occurred while retrieving movie details.', movies: [] });
                    });
                }
              });
            }
          });
        }
      });
    } else {
      return res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });

  app.post('/remove-watchlist', (req, res) => {
    if (req.session.loggedin) {
      const username = req.session.username;
      console.log(username);
      const movieId = req.body.movieId;
  
      if (!movieId) {
        return res.status(400).send('Movie ID cannot be empty');
      }
  
      const deleteSql = 'DELETE FROM user_watchlist WHERE username = ? AND movie_id = ?';
      const deleteValues = [username, movieId];
  
      connection.query(deleteSql, deleteValues, (err, result) => {
        if (err) {
          res.render('watchlist', { message: 'An error occurred while removing the movie from the watchlist.', movies: [] });
        } else {
          const selectSql = 'SELECT movie_id FROM user_watchlist WHERE username = ?';
          const selectValues = [username];
  
          connection.query(selectSql, selectValues, (err, results) => {
            if (err) {
              res.render('watchlist', { message: 'An error occurred while retrieving your watchlist.', movies: [] });
            } else {
              const movieIds = results.map(result => result.movie_id);
              const fetchPromises = movieIds.map(movieId => {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=f7b138552a3ba34c25115cff576920df&language=en-US`;
                return fetch(tmdbUrl).then(response => response.json());
              });
  
              Promise.all(fetchPromises)
                .then(movies => {
                  res.render('watchlist', { movies, message: 'Movie removed from your watchlist.' });
                })
                .catch(err => {
                  console.error(err);
                  res.render('watchlist', { message: 'An error occurred while retrieving movie details.', movies: [] });
                });
            }
          });
        }
      });
    } else {
      return res.send('Please login to view this page! <a href="/">Login here</a>');
    }
  });
  


  app.get('/dashboard', async (req, res) => {
    if (req.session.loggedin) {
      try {
          const movieDetails = req.query.movieName ? await getMovieDetails(req.query.movieName) : null;
          res.render('dashboard', { username: req.session.username, movieDetails });
      } catch (error) {
          console.error(error);
          res.status(500).send(error.message);
      }
  } else {
      return res.send('Please login to view this page! <a href="/">Login here</a>');
  }
  });
  
 app.listen(3000, () => {
    console.log('Server started on port 3000');
  });
