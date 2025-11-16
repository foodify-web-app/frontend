// stores/useStore.js
import { create } from 'zustand';
import axios from 'axios';
// import { food_list } from '../assets/assets';
import { toast } from 'sonner';
let authUrl = "http://localhost:4000/api/auth"

export const api = axios.create({
    // baseURL: "https://api.yourdomain.com", // replace with your backend base URL
    // withCredentials: true, // needed if using cookies for refresh tokens
});

// Request Interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) config.headers.token = `${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor (handle 401)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401) {
            try {
                const { data } = await api.post(
                    `${authUrl}/refresh-token`,
                    {},
                    { headers: { token: originalRequest.headers.token } },
                );

                const newAccessToken = data.accessToken;
                localStorage.setItem("token", newAccessToken);
                api.defaults.headers.token = `${newAccessToken}`;
                return api(originalRequest); // retry original request
            } catch (err) {
                console.error("Refresh token expired or invalid");
                window.location.href = "/"; // redirect to login
            }
        }

        return Promise.reject(error);
    }
);


export const useStore = create((set, get) => ({
    authUrl: "http://localhost:4000/api/auth",
    userUrl: "http://localhost:4001/api/user",
    dishUrl: "http://localhost:4002/api/dish",
    cartUrl: "http://localhost:4003/api/cart",
    orderUrl: "http://localhost:4004/api/order",
    token: '',
    food_list: [],
    cartItems: {},
    userId: '',

    setUserId: (userId) => set({ userId }),

    resetCart: () => set({ cartItems: {} }),

    setToken: (token) => set({ token }),

    setFoodList: (food_list) => set({ food_list }),

    fetchFoodList: async () => {
        try {
            const { dishUrl, setFoodList } = get();
            const response = await api.get(`${dishUrl}/all`);
            setFoodList(response.data.data);
        } catch (error) {
            console.error('Error fetching food list:', error);
        }
    },

    addToCart: async (itemId) => {
        const { cartItems, token, cartUrl, dishUrl } = get();
        const updatedCart = { ...cartItems };

        if (!updatedCart[itemId]) {
            updatedCart[itemId] = 1;
        } else {
            updatedCart[itemId]++;
        }

        set({ cartItems: updatedCart });

        const dish = await api.get(`${dishUrl}/${itemId}`)
        toast.success(`${dish.data.data[0].name} added to cart`, {
            icon: '🛒',
            duration: 3000,
        });


        if (token) {
            try {
                await api.post(`${cartUrl}/add`, { itemId });
            } catch (error) {
                console.error('Error adding to cart:', error);
            }
        }
    },

    removeFromCart: async (itemId) => {
        const { cartItems, token, cartUrl, dishUrl } = get();
        const updatedCart = { ...cartItems };
        updatedCart[itemId] = updatedCart[itemId] - 1;
        set({ cartItems: updatedCart });

        const dish = await api.get(`${dishUrl}/${itemId}`)
        toast.error(`${dish.data.data[0].name} removed from cart`, {
            icon: '🛒',
            duration: 3000,
        });

        if (token) {
            try {
                await api.post(`${cartUrl}/remove`, { itemId });
            } catch (error) {
                console.error('Error removing from cart:', error);
            }
        }
    },

    loadCartData: async () => {
        const { cartUrl, userId, token } = get();
        try {
            const response = await api.get(`${cartUrl}/userid/${userId}`);
            set({ cartItems: response.data.cartData });
        } catch (error) {
            console.error('Error loading cart data:', error);
        }
    },

    getTotalCartAmount: () => {
        const { cartItems, food_list } = get();
        let total = 0;

        for (const itemId in cartItems) {
            const item = food_list.find((i) => i._id === itemId);
            if (item && cartItems[itemId] > 0) {
                total += item.price * cartItems[itemId];
            }
        }

        return total;
    },
}));
