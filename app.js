import express from 'express';
import session from 'express-session';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import axios from 'axios';
import bcrypt from 'bcryptjs';
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
app.use(bodyParser.json());

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

app.use(express.static('public'));


app.get('/search', (req, res) => {
  res.render('search');
});


app.get('/tv_search', (req, res) => {
  if (req.session.loggedin) {
  res.render('tv_search');}
  else{
    return res.send('Please login to view this page! <a href="/">Login here</a>');
  }
});


const connection = mysql.createConnection({
    host: 'sql12.freemysqlhosting.net	',
    user: 'sql12652610',
    password: 'GtIvI1fmiE',
    database: 'sql12652610'
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
 
  app.get('/movie-details1', (req, res) => {
    const movieId = req.query.id;
    const apiKey = "cb271ca40b23866a540695b98e939277";
  
    // retrieve movie details, poster, credits, and reviews from external API
    const movieDetailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}&language=en-US`;
    const moviePosterUrl = `https://api.themoviedb.org/3/movie/${movieId}/images?api_key=${apiKey}`;
    const movieCreditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${apiKey}`;
  
    Promise.all([fetch(movieDetailsUrl), fetch(moviePosterUrl), fetch(movieCreditsUrl)])
      .then(([detailsResponse, posterResponse, creditsResponse]) => Promise.all([detailsResponse.json(), posterResponse.json(), creditsResponse.json()]))
      .then(([movieDetails, posterDetails, credits]) => {
        // retrieve reviews for this movie from MySQL
        const reviewsQuery = `SELECT review,username FROM review_data where movie_id = ? `;
        connection.query(reviewsQuery, [movieId], (error, reviewsResults) => {
          if (error) {
            console.error(error);
            res.send("Nothing found");
            return;
          }
  
          // fetch images of the cast
          const castIds = credits.cast.slice(0, 5).map(cast => cast.id);
          const castImageUrl = `https://api.themoviedb.org/3/person/${castIds.join()}?api_key=${apiKey}&language=en-US&append_to_response=images`;
  
          fetch(castImageUrl)
            .then(response => response.json())
            .then(castDetails => {
              // pass movie details, poster, credits, and reviews to template for rendering
              res.render('movie-details1', {
                movieId: movieId,
                title: movieDetails.title,
                release_year: new Date(movieDetails.release_date).getFullYear(),
                genres: movieDetails.genres.map(genre => genre.name).join(', '),
                director: credits.crew.find(person => person.job === 'Director').name,
                rating: movieDetails.vote_average,
                description: movieDetails.overview,
                cast: credits.cast.slice(0, 5),
                castImages: castDetails.images.profiles,
                reviews: reviewsResults,
                poster: `https://image.tmdb.org/t/p/original${movieDetails.poster_path}` // use the first poster returned by the API
              });
            })
            .catch(error => {
              console.error(error);
              res.render('error', { message: 'An error occurred while retrieving cast details.' });
            });
        });
      })
      .catch(error => {
        console.error(error);
        res.render('error', { message: 'An error occurred while retrieving movie details.' });
      });
  });
  
  
  
  app.post('/add-review', (req, res) => {
  const user = req.session.username;
    
  const movieId = req.body.movieId;
  console.log(movieId)
  const review = req.body.review;


    if (!movieId || !review) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
  
    const query = `INSERT INTO review_data (movie_id, review, username ) VALUES (${movieId}, '${review}',' ${user}')`;
  
    connection.query(query, (error, results) => {
      if (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error adding review' });
      } else {
        res.status(200).json({ success: true, message: 'Review added successfully' });
      }
    });
  });
  

  app.post('/add-discussion', (req, res) => {
    if (!req.session.loggedin) {
      return res.redirect('/');
    }
    const movie_id = req.body.movieId;

    const username = req.session.username;
    const { discussion_text } = req.body;
    
  
    // insert discussion data into database
    const sql = `INSERT INTO discussions (movie_id, parent_username, title) VALUES (?, ?, ?)`;
    const values = [movie_id, username, discussion_text];
  
    connection.query(sql, values, (err, result) => {
      if (err) throw err;
  
      console.log(`Discussion added for movie_id ${movie_id} by ${username}`);
      //res.render('discussions');
      res.redirect('/discussions')
    
    });
  });

  app.get('/discussions', function(req, res) {
    if (!req.session.loggedin) {
      return res.redirect('/');
    }
    connection.query('SELECT d.id, d.movie_id, d.parent_username, d.title, d.date_created, dt.username, dt.discussion_text FROM discussions d LEFT JOIN discussions_threads dt ON d.id = dt.discussion_id', function(error, results) {
      if (error) throw error;
  
      // Create an empty array to store the discussion data
      const discussions = [];
  
      // Iterate over the results array and create a new object for each discussion
      results.forEach(function(result) {
        // Check if the discussion already exists in the discussions array
        const existingDiscussion = discussions.find(function(discussion) {
          return discussion.id === result.id;
        });
  
        // If the discussion doesn't exist in the array, create a new object for it
        if (!existingDiscussion) {
          const discussionData = {
            id: result.id,
            movie_id: result.movie_id,
            parent_username: result.parent_username,
            title: result.title,
            date_created: result.date_created,
            threads: []
          };
          discussions.push(discussionData);
        }
  
        // Add the discussion thread to the existing discussion object
        if (result.username && result.discussion_text) {
          const threadData = {
            username: result.username,
            discussion_text: result.discussion_text,
            date_created: result.date_created
          };
  
          // Check if existingDiscussion is defined before pushing the threadData object into its threads array
          if (existingDiscussion && existingDiscussion.threads) {
            existingDiscussion.threads.push(threadData);
          }
        }
      });
  
      // Create an empty array to store the movie data
      const movies = [];
  
      // Iterate over the discussions array and make an API request for each movie_id
      discussions.forEach(function(discussion) {
        const movieId = discussion.movie_id;
        const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=cb271ca40b23866a540695b98e939277`;
        axios.get(url)
          .then(function(response) {
            const movieData = {
              id: movieId,
              title: response.data.title,
              poster: `https://image.tmdb.org/t/p/w500/${response.data.poster_path}`
            };
            movies.push(movieData);
            if (movies.length === discussions.length) {
  
              //Render the discussion.ejs template with the discussions, movies and threads data
              res.render('discussion', { discussions: discussions, movies: movies });
            }
          })
          .catch(function(error) {
            console.log(error);
          });
      });
  
    });
  });
  

  app.post('/discussions/threads/new', function(req, res) {
    if (!req.session.loggedin) {
      return res.redirect('/');
    }
    const discussionId = req.body.discussion_id;
    const username = req.session.username;
    const discussionText = req.body.discussion_text;
    const dateCreated = new Date();
    
    const sql = 'INSERT INTO discussions_threads (discussion_id, username, discussion_text, datee) VALUES (?, ?, ?, ?)';
    connection.query(sql, [discussionId, username, discussionText, dateCreated], function(error, results) {
      if (error) throw error;
      
      res.redirect('/discussions');
    });
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
                res.render('library', { movies, message: ` added to your library. `, error: true });
              })
              .catch(err => {
                console.error(err);
                res.render('library', { movies, message: `Movie could not be added to your library.`, error: true });
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



  app.get('/tv-details', function(req, res) {
    res.render('tv-details.ejs');
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
  
 app.listen(5000, () => {
    console.log('Server started on port 5000');
  });
