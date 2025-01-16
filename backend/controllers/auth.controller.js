const signup = (req, res) => {
  res.json({ data: "You hit the signup endpoint" });
};

const login = (req, res) => {
  res.json({ data: "You hit the login endpoint" });
};

const logout = (req, res) => {
  res.json({ data: "You hit the logout endpoint" });
};

export { signup, login, logout };
