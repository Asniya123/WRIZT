const Wishlist = require('../models/wishlistModel')
const User = require('../models/userModel')
const Category = require('../models/categoryModel')
const Product = require('../models/productModel')
const mongoose = require('mongoose')



const loadWishlist = async (req, res) => {
    try {
        const user = req.session.user_id;
        const userWishlist = await Wishlist.findOne({ user: user }).populate(
            "items.product"
        );

        const userWishlistItems = userWishlist ? userWishlist: [];
        res.render("wishlist", { Wishlist: userWishlistItems, user });
    } catch (err) {
        console.error("Error fetching user wishlist:", err);
        res.status(500).send("Internal Server Error");
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const productId = req.body.productId;
        console.log("userId:", userId);
        console.log("productId:", productId);

        if (!userId || !productId) {
            return res.status(400).json({ success: false, message: "Invalid userId or productId" });
        }

        let userWishlist = await Wishlist.findOne({ user: userId });

        if (!userWishlist) {
            userWishlist = new Wishlist({
                user: userId,
                items: [{ product: productId }],
            });
        } else {
            const existingWishlistItem = userWishlist.items.find(
                (item) => item.product && item.product.toString() === productId
            );

            if (existingWishlistItem) {
                return res.json({ success: false, message: "Product already in wishlist" });
            } else {
                const newItem = { product: productId };

                // Check if productId is not undefined before pushing into the items array
                if (productId) {
                    userWishlist.items.push(newItem);
                } else {
                    return res.status(400).json({ success: false, message: "Invalid productId" });
                }
            }
        }

        await userWishlist.save();
        res.json({ success: true, message: "Product added to the wishlist successfully." });
    } catch (error) {
        console.error("Error adding product to wishlist:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};






const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const productId = req.query.productId;

        if (!userId) {
            console.error("User ID is missing.");
            return res.status(400).json({ error: "User ID is missing." });
        }

        let userWishlist = await Wishlist.findOne({ user: userId });

        if (!userWishlist) {
            return res.status(404).json({ error: "Wishlist not found." });
        }

        userWishlist.items = userWishlist.items.filter(item => item.product.toString() !== productId);

        await userWishlist.save();

        res.json({ success: true, message: "Product removed from the wishlist successfully." });
    } catch (error) {
        console.error("Error removing product from wishlist:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
  
  

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist
}          
