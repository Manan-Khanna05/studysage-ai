export const SAMPLE_NOTES = `A database is an organised collection of related data that is stored and accessed electronically. A database management system, or DBMS, is software that lets users create, read, update and delete data in a database while keeping it consistent and safe.

The DBMS sits between the user and the stored data. It provides data independence, which means the logical structure of the data can change without forcing every application to change. It also enforces integrity constraints, so invalid data cannot be entered into the database.

A relational database stores data in tables, where each table has rows and columns. Each row is called a tuple and represents one record, while each column is called an attribute and represents one property of that record. Every table must have a primary key, which is a column or a set of columns that uniquely identifies each row.

A foreign key is a column in one table that refers to the primary key of another table. Foreign keys create relationships between tables and enforce referential integrity, which means a row cannot reference a record that does not exist.

Normalization is the process of organising data to reduce redundancy and improve integrity. First normal form requires every column to hold atomic values, so no cell contains a list or a repeating group. Second normal form requires the table to be in first normal form and every non-key attribute to depend on the whole primary key. Third normal form requires the table to be in second normal form and every non-key attribute to depend only on the primary key, with no transitive dependency.

An entity relationship diagram, or ER diagram, is a visual model of the data. An entity is a real-world object such as a student or a course, an attribute is a property of an entity, and a relationship describes how entities are connected. The cardinality of a relationship can be one to one, one to many, or many to many.

An index is a data structure that speeds up data retrieval on a table. A B-tree index keeps keys in sorted order, so searching for a value is much faster than scanning every row. Indexes make reads faster, but they slow down inserts and updates because the index must also be maintained.

A transaction is a sequence of operations that must be treated as a single unit of work. A transaction follows the ACID properties. Atomicity means all operations in the transaction succeed or none of them do. Consistency means the transaction moves the database from one valid state to another valid state. Isolation means concurrent transactions do not interfere with each other. Durability means the changes of a committed transaction survive even if the system crashes.

Concurrency control manages simultaneous access to the database. Locking is one common technique, where a transaction holds a lock on the data it is using until it finishes. Two-phase locking requires a transaction to acquire all its locks before it releases any of them, which helps prevent lost updates.

Structured Query Language, or SQL, is the standard language for relational databases. The SELECT statement retrieves data, the INSERT statement adds new rows, the UPDATE statement modifies existing rows, and the DELETE statement removes rows. The WHERE clause filters rows, the GROUP BY clause groups rows for aggregate functions, and the JOIN clause combines rows from two or more tables.

Database recovery uses a log that records every change before it is written to the database. After a crash, the system can use the log to redo committed transactions and undo uncommitted transactions, restoring the database to a consistent state.`
