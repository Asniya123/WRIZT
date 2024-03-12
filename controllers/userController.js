const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const message = require("../config/mailer");
const Wallet = require("../models/walletModel")
const Banner = require("../models/bannerModel")
const { generate } = require("randomstring");


const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};



const loadRegister = async(req,res)=>{
  try{
    
      res.render('registration')

  } catch(error){
      console.log(error.message);
  }
}

const insertUser = async (req, res) => {
  try {
    const email = req.body.email;
    const mobile = req.body.mobile;
    const name = req.body.name;
    const password = req.body.password;

    if (!email || !mobile || !name || !password) {
      return res.render("registration", {
        message: "Please fill in all the fields",
      });
    }

    const existEmail = await User.findOne({ email: email });
    const existMobile = await User.findOne({ mobile: mobile });

    if (existEmail) {
      return res.render("registration", { message: "This email is already registered" });
    } else if (existMobile) {
      return res.render("registration", { message: "This mobile number is already registered" });
    } else {
      req.session.userData = req.body;
      req.session.register = 1;
      req.session.email = email;
      
      if (req.session.email) {
        const data = await message.sendVerifyMail(req, req.session.email);
        res.redirect("/otp");
      }
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};

// GET OTP PAGE
const loadOtp = async (req, res) => {
  try {
    res.render("otp");
  } catch (error) {
    console.log(error.message);
  }
};

// VERIFYOTP
const verifyOtp = async (req, res) => {
  try {
  
    const userData = req.session.userData;
    
    const fullOTP = req.body.otp;
  
    if (!req.session.user_id) {
      
      if (fullOTP == req.session.otp) {
        
        const secure_password = await securePassword(userData.password);
        const user = new User({
          name: userData.name,
          email: userData.email,
          mobile: userData.mobile,
          password: secure_password,
          image:'',
          isAdmin: 0,
          is_blocked: 1,
        });

        const userDataSave = await user.save();
        if (userDataSave && userDataSave.isAdmin === 0) {
      
          req.session.user_id = userDataSave._id;

          res.redirect("/");
        } else {
          res.render("otp", { message: "Registration Failed" });
        
        }
      } else {
        res.render("otp", { message: "invailid otp" });
        
      }
    } else {
      if (fullOTP.trim() == req.session.otp.trim()) {
        res.redirect("/resetPassword");
      } else {
        res.render("otp", { message: "Incorrect OTP. Please try again." });
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};

const resendOTP = async (req, res) => {
  try {
    // Retrieve user data from session storage
    const userData = req.session.userData;

    if (!userData) {
      res.status(400).json({ message: "Invalid or expired session" });
    } else {
      delete req.session.otp;
      const data = await message.sendVerifyMail(req, userData.email);
    }

    // Generate and send new OTP using Twilio

    res.render("otp", { message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error: ", error);
    res.render("otp", { message: "Failed to send otp" });
  }
};


const loadShop = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData = await User.findById(userId);

    // Extracting query parameters
    let { search: searchQuery, category: categoryId, sort, page } = req.query;

    // Reset the page to 1 if search or category filter is applied
    if (searchQuery || categoryId) {
        page = 1; // Reset to page 1 if there's a new search or category selection
    } else {
        page = parseInt(page) || 1; // Use the existing page number or default to 1
    }

    const perPage = 9;
    const query = { is_listed: true };

    // Apply search and category filters to the query
    if (searchQuery) {
      query.name = { $regex: new RegExp(searchQuery, 'i') };
    }
    if (categoryId) {
      query.category = categoryId;
    }

    // Sorting logic remains the same
    let sortOption = {};
    if (sort === 'asc') {
        sortOption = { price: 1 };
    } else if (sort === 'desc') {
        sortOption = { price: -1 };
    }
    

    // The rest of your product fetching logic remains unchanged
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);
    const productData = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip((page - 1) * perPage)
      .limit(perPage);

    const categories = await Category.find();

    res.render('shop', {
      products: productData,
      userData,
      categories,
      currentPage: page,
      totalPages: totalPages,
      sort,
      category: categoryId,
      searchQuery: searchQuery,
      query: req.query // Pass the entire query object to your template
    });
    
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};


const loadShopCategory = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData = await User.findById(userId);
    const categoryId = req.query.categoryId;
    const searchQuery = req.query.search || '';
    const sort = req.query.sort;

    let totalProducts;

    let sortOption = {};
    if (sort === 'asc') {
      sortOption = { discount_price: 1 };
    } else if (sort === 'desc') {
      sortOption = { discount_price: -1 };
    } else {
      sortOption = {};
    }

    const findQuery = categoryId ? { category: categoryId } : {};
    if (searchQuery) {
      findQuery.name = { $regex: new RegExp(searchQuery, 'i') };
    }

    totalProducts = await Product.countDocuments(findQuery);

    const categories = await Category.find();
    const page = req.query.page || 1;
    const itemsPerPage = 6;
    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    const options = {
      page: page,
      limit: itemsPerPage,
      sort: sortOption,
      populate: 'category', // Assuming there's a category field in your Product model
    };

    const paginatedProducts = await Product.paginate(findQuery, options);

    const distinctValues = await Product.aggregate([
      {
        $group: {
          _id: null,
          categories: { $addToSet: '$category' },
        },
      },
    ]).shift();

    const distinctCategories = {
      categories: distinctValues.categories || [],
    };

    res.render('shop', {
      products: paginatedProducts.docs,
      userData,
      totalPages: totalPages,
      currentPage: paginatedProducts.page,
      categories,
      query: findQuery,
      sort,
      categoryId: categoryId,
      searchQuery: searchQuery,
      distinctValues: distinctCategories,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};






const loadSingleShop = async (req, res) => {
  try {
      const userId = req.session.user_id;
      const userData = await User.findById(userId);
      const productId = req.params.id;
      const product = await Product.findById(productId);
      const categories = await Category.find();

      let insufficientStockMessage = null;

      // Assuming your condition is to check if the requested quantity is greater than the product stock
      const requestedQty = req.body.qty; // Make sure this is the correct way to access the quantity from the request

      if (parseInt(requestedQty, 10) > product.stock) {
          insufficientStockMessage = "Insufficient stock.";
      }

      res.render("singleProduct", { userData, product, categories, userId, insufficientStockMessage });
  } catch (error) {
      console.log(error.message);
      // Handle the error appropriately, e.g., redirecting to an error page
      res.status(500).send("Internal Server Error");
  }
};



  


// GET LOGIN
const loadLogin = async (req, res) => {
  try {
    res.render("login",{message:''});
  } catch (error) {
    console.log(error.message);
  }
};
// POST LOGIN
const verifyLogin = async (req, res) => {
  try {
    console.log(req.body);
    const email = req.body.email;
    const password = req.body.password;

    const userData = await User.findOne({ email: email });
    if (userData) {
      if (userData.is_blocked==0) {
        res.render("login", { message: "Your account is blocked." });
        return; // Exit the function to prevent further execution
      }

      const passwordmatch = await bcrypt.compare(password, userData.password);

      if (passwordmatch) {
        if (userData.is_verified === 0) {
          res.render("login", { message: "please verify your mail" });
        } else {
          req.session.user_id = userData._id;
          console.log(req.session.user_id)
          res.redirect("/home");
          // res.render('home',{user:req.session})
        }
      } else {
        res.render("login", { message: " password is incorrect" });
      }
    } else {
      res.render("login", { message: "User Not Found" });
    }
  } catch (error) {
    res.redirect('/404')
  }
};

// GET LOGIN
const loadForgetpassword = async (req, res) => {
  try {
    res.render("forget");
  } catch (error) {
    console.log(error.message);
  }
};


const forgotPasswordOTP = async (req, res) => {
  try {
    const emaildata = req.body.email;
    console.log("Email received:", emaildata);

    const userExist = await User.findOne({ email: emaildata });
 
    if (userExist) {
      req.session.userData = userExist;
      req.session.user_id = userExist._id;
      console.log(userExist._id);
    
      // Assuming you have a message-sending utility
      const data = await message.sendVerifyMail(req, userExist.email);
     
    
      res.render("otp");
    }
     else {
      res.render("forget", {
        error: "Attempt Failed",
        User: null,
        
      });
    }
  } catch (error) {
    console.log("Error:", error.message);
  }
};



const resetPassword = async (req, res) => {
  try {
    const user_id = req.session.user_id;
    const password = req.body.password;
    const secure_password = await securePassword(password);

    const updatedData = await User.findOneAndUpdate(
      { _id: user_id },
      { $set: { password: secure_password } },
      { new: true } // to return the updated document
    );

    if (updatedData) {
      res.redirect("/login");
    }
  } catch (error) {
    console.log(error.message);
  }
};
               



const loadResetPassword = async(req,res) => {
  try{
    if(req.session.user_id){
      const userId = req.session.user_id
      const user = await User.findById(userId)
      res.render("resetPassword",{User: user})
    }else {
      res.redirect("/forget")
    }
  }catch(error){
    console.log(error.message);
  }
}

const getBestSellingProducts = async () => {
  try {
    // Assuming you have a field like salesCount in your Product model
    const bestSellingProducts = await Product.find({ is_listed: true })
      .sort({ salesCount: -1 }) // Sort in descending order based on salesCount
      .limit(3); // Adjust the limit based on how many best-selling products you want

    return bestSellingProducts;
  } catch (error) {
    console.error("Error fetching best-selling products:", error);
    throw error;
  }
};


const loadHome = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData = await User.findById(userId);
    const productData = await Product.find({ is_listed: true });
    const categories = await Category.find();
    const banners = await Banner.find({ isListed: true })
    .populate("product");
    

    // Assuming you have a function to get best selling products
    const bestSellingProducts = await getBestSellingProducts();

    if (req.session.userData) {
      res.render("home", {
        products: productData,
        User: userData,
        categories,
        banners,
        bestSellingProducts, // Add bestSellingProducts to the template
      });
    } else {
      res.render("home", {
        userData: null,
        banners,
        products: productData,
        categories,
        bestSellingProducts, // Add bestSellingProducts to the template
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};



const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData = await User.findById(userId);
    if (userData) {
      res.render("userProfile", { userData }); // Pass userData to the template
    } else {
      res.redirect("/login"); 
    }
  } catch (error) {
    console.log(error.message);
  }
};



const userEdit = async (req, res) => {
  try {
    let id = req.body.user_id;
    const userData = await User.findById(id);
    const { name, mobile } = req.body;

    let updateData;

    if (!req.file) {
      updateData = await User.findByIdAndUpdate(
        { _id: id },
        {
          $set: {
            name,
            mobile,
          },
        }
      );
    } else {
      updateData = await User.findByIdAndUpdate(
        { _id: id },
        {
          $set: {
            name,
            mobile,
            image: req.file.filename,
          },
        }
      );
    }

    await updateData.save();
    res.render("userProfile", { userData });
  } catch (error) {
    console.log(error.message);
  }
};

const userLogout = async (req, res) => {
  try {
    req.session.destroy();

    res.redirect("/login");
  } catch (error) {
    console.log(error.message);
  }
};



//Wallet
const loadWallet = async(req,res) => {
  try{
    const userId = req.session.user_id
    const userData = await User.findById(userId)
    if(!userData){
      return res.render("login", {userData: null})
    }

    const walletData = await Wallet.findOne({user: userId})

    if(!walletData){
      return res.render("wallet", {userData, wallet:[]})
    }
    res.render("wallet", {userData, wallet: walletData})
  }
  catch(err){
    console.error("Error in loadWallet route:", err)
    res.status(500).send("Internal Server Error ")
  }
}


const filterProducts = async (req, res) => {
  try {
    const { minPrice, maxPrice } = req.body;

    if (!minPrice || !maxPrice) {
      return res.status(400).json({ error: 'Minimum and maximum prices are required' });
    }

    // Assuming you have a Price model to store the price range
    const priceRange = await Price.findOne({ min: minPrice, max: maxPrice });

    if (!priceRange) {
      return res.status(404).json({ error: 'Price range not found' });
    }

    const products = await Product.find({
      price: { $gte: priceRange.min, $lte: priceRange.max },
      is_listed: true,
    });

    const categories = await Category.find();

    // Assuming you have a distinctValues object similar to what you use in your shop route
    const distinctValues = await Product.aggregate([
      {
        $group: {
          _id: null,
          categories: { $addToSet: '$category' },
        },
      },
    ]).shift();

    const distinctCategories = {
      categories: distinctValues.categories || [],
    };

    const userId = req.session.user_id;
    const userData = await User.findById(userId);

    res.render('/shop', {
      products,
      userData,
      categories,
      distinctValues: distinctCategories,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



const loadAbout = async (req, res) => {
  try {
    const userId = req.session.user_id;

    const userData = await User.findById(userId);
  
    if (userData) {
      res.render("about", {  userData,  });
    } else {
      res.render("about", { userData: null,  });
    }
  } catch (error) {
    console.log(error.message);
  }
};


const loadContact = async (req, res) => {
  try {
    const userId = req.session.user_id;

    const userData = await User.findById(userId);
  
    if (userData) {
      res.render("contact", {  userData,  });
    } else {
      res.render("contact", { userData: null,  });
    }
  } catch (error) {
    console.log(error.message);
  }
};


const errorPage = async (req, res) => {
  try {
    res.status(404).render('404');
  } catch (error) {
    console.log(error);
  }
}







module.exports = {
  loadLogin,
  insertUser,
  loadRegister,
  loadHome,
  userLogout,
  loadOtp,
  verifyOtp,
  verifyLogin,
  resendOTP,
  loadShop,
  loadSingleShop,
  loadForgetpassword,
  forgotPasswordOTP,
  resetPassword,
  loadResetPassword,
  loadProfile,
  userEdit,
  loadShopCategory,
  loadWallet,
  filterProducts,
  loadAbout,
  loadContact,
  errorPage
};
