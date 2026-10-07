const express = require("express");
const router = express.Router();
const db = require("../db");

// Validation helper
const validateContactData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  if (!data.businessName || data.businessName.trim().length < 2) {
    errors.push("Business name must be at least 2 characters");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push("Valid email is required");
  }

  const phoneRegex = /^[+\d][\d\s\-()]{7,20}$/;
  if (!data.phone || !phoneRegex.test(data.phone)) {
    errors.push("Valid phone number is required");
  }

  if (!data.businessType || data.businessType.trim().length === 0) {
    errors.push("Business type is required");
  }

  return errors;
};

// POST /api/contact - Submit demo request
router.post("/", async (req, res) => {
  try {
    const { name, businessName, phone, email, businessType, message } = req.body;

    // Validate
    const errors = validateContactData({
      name,
      businessName,
      phone,
      email,
      businessType,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Get IP address
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      null;

    // Insert into database
    const [result] = await db.execute(
      `INSERT INTO demo_requests 
       (name, business_name, phone, email, business_type, message, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        businessName.trim(),
        phone.trim(),
        email.trim().toLowerCase(),
        businessType.trim(),
        message ? message.trim() : null,
        ipAddress,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Thank you! Your demo request has been submitted. We'll contact you within 24 hours.",
      data: {
        id: result.insertId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit your request. Please try again.",
      error: error.message,
    });
  }
});

// GET /api/contact - Get all demo requests (admin)
router.get("/", async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    let query = "SELECT * FROM demo_requests WHERE 1=1";
    const params = [];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    if (search) {
      query +=
        " AND (name LIKE ? OR email LIKE ? OR business_name LIKE ? OR phone LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY created_at DESC";

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const [rows] = await db.execute(query, params);

    // Count total
    let countQuery = "SELECT COUNT(*) as total FROM demo_requests WHERE 1=1";
    const countParams = [];

    if (status) {
      countQuery += " AND status = ?";
      countParams.push(status);
    }
    if (search) {
      countQuery +=
        " AND (name LIKE ? OR email LIKE ? OR business_name LIKE ? OR phone LIKE ?)";
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await db.execute(countQuery, countParams);
    const total = countResult[0].total;

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch demo requests",
      error: error.message,
    });
  }
});

// GET /api/contact/:id - Get single demo request
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT * FROM demo_requests WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Demo request not found",
      });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Get contact error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch demo request",
      error: error.message,
    });
  }
});

// PATCH /api/contact/:id/status - Update status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["new", "contacted", "converted", "closed"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", "),
      });
    }

    const [result] = await db.execute(
      "UPDATE demo_requests SET status = ? WHERE id = ?",
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Demo request not found",
      });
    }

    return res.json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
});

// DELETE /api/contact/:id - Delete demo request
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.execute(
      "DELETE FROM demo_requests WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Demo request not found",
      });
    }

    return res.json({
      success: true,
      message: "Demo request deleted successfully",
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete demo request",
      error: error.message,
    });
  }
});

module.exports = router;